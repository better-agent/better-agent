import path from "node:path";
import ts from "typescript";
import type { TypegenAppReference } from "./types";

const DEFAULT_TYPE_NAME = "BAClientApp";
const TYPE_FORMAT_FLAGS =
    ts.TypeFormatFlags.NoTruncation |
    ts.TypeFormatFlags.UseFullyQualifiedType |
    ts.TypeFormatFlags.WriteTypeArgumentsOfSignature |
    ts.TypeFormatFlags.MultilineObjectLiterals |
    ts.TypeFormatFlags.InTypeAlias;

type PortableNode =
    | { kind: "literal"; value: string | number | boolean | null }
    | { kind: "keyword"; value: "string" | "number" | "boolean" | "unknown" | "null" | "undefined" }
    | { kind: "union"; members: PortableNode[] }
    | { kind: "object"; properties: PortableProperty[] }
    | { kind: "array"; element: PortableNode; readonly: boolean }
    | { kind: "tuple"; elements: PortableNode[]; readonly: boolean };

type PortableProperty = {
    name: string;
    optional?: boolean;
    value: PortableNode;
};

type ExtractContext = {
    checker: ts.TypeChecker;
    path: string;
};

export class TypegenRenderError extends Error {
    path: string;

    constructor(path: string, message: string) {
        super(`${path}: ${message}`);
        this.name = "TypegenRenderError";
        this.path = path;
    }
}

const toPropertyName = (value: string) =>
    /^[$A-Z_a-z][$\w]*$/.test(value) ? value : JSON.stringify(value);

const loadCompilerOptions = (configFiles: string[]) => {
    const configPath = configFiles
        .map((configFile) => ts.findConfigFile(path.dirname(configFile), ts.sys.fileExists))
        .find((value): value is string => typeof value === "string");

    if (!configPath) {
        return {
            allowJs: true,
            checkJs: false,
            esModuleInterop: true,
            jsx: ts.JsxEmit.Preserve,
            module: ts.ModuleKind.ESNext,
            moduleResolution: ts.ModuleResolutionKind.Bundler,
            resolveJsonModule: true,
            skipLibCheck: true,
            strict: false,
            target: ts.ScriptTarget.ES2022,
        } satisfies ts.CompilerOptions;
    }

    const parsed = ts.getParsedCommandLineOfConfigFile(
        configPath,
        {},
        {
            ...ts.sys,
            onUnRecoverableConfigFileDiagnostic: () => {},
        },
    );

    return parsed?.options ?? {};
};

const isLiteralLike = (node: ts.Expression) =>
    ts.isStringLiteralLike(node) ||
    ts.isNumericLiteral(node) ||
    node.kind === ts.SyntaxKind.TrueKeyword ||
    node.kind === ts.SyntaxKind.FalseKeyword ||
    node.kind === ts.SyntaxKind.NullKeyword;

const unwrapExpression = (expression: ts.Expression): ts.Expression => {
    let current = expression;
    while (
        ts.isParenthesizedExpression(current) ||
        ts.isAsExpression(current) ||
        ts.isSatisfiesExpression(current) ||
        ts.isTypeAssertionExpression(current)
    ) {
        current = current.expression;
    }
    return current;
};

const getExportSymbol = (
    checker: ts.TypeChecker,
    sourceFile: ts.SourceFile,
    exportPath: string[],
): ts.Symbol | undefined => {
    const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
    if (!moduleSymbol) return undefined;

    let currentSymbol = checker.getExportsOfModule(moduleSymbol).find((symbol) => {
        const name = symbol.escapedName.toString();
        return name === exportPath[0];
    });

    for (const segment of exportPath.slice(1)) {
        if (!currentSymbol) return undefined;
        const declaration = currentSymbol.valueDeclaration ?? currentSymbol.declarations?.[0];
        if (!declaration) return undefined;
        const currentType = checker.getTypeOfSymbolAtLocation(currentSymbol, declaration);
        currentSymbol = checker.getPropertyOfType(currentType, segment);
    }

    return currentSymbol;
};

const renderPortableNode = (node: PortableNode, indent = 0): string => {
    const spacing = " ".repeat(indent);

    switch (node.kind) {
        case "literal":
            return node.value === null ? "null" : JSON.stringify(node.value);
        case "keyword":
            return node.value;
        case "union":
            return node.members.map((member) => renderPortableNode(member, indent)).join(" | ");
        case "array":
            return `${node.readonly ? "readonly " : ""}${renderPortableNode(node.element, indent)}[]`;
        case "tuple":
            return `${node.readonly ? "readonly " : ""}[${node.elements
                .map((element) => renderPortableNode(element, indent))
                .join(", ")}]`;
        case "object":
            if (node.properties.length === 0) return "{}";
            return `{\n${node.properties
                .map(
                    (property) =>
                        `${spacing}    ${toPropertyName(property.name)}${property.optional ? "?" : ""}: ${renderPortableNode(property.value, indent + 4)};`,
                )
                .join("\n")}\n${spacing}}`;
    }
};

const renderTypeAlias = (typeName: string, node: PortableNode, label: string) =>
    `/** ${label} */\nexport type ${typeName} = ${renderPortableNode(node)};`;

const formatCallableType = (checker: ts.TypeChecker, type: ts.Type) => {
    const rendered = checker.typeToString(type, undefined, TYPE_FORMAT_FLAGS);
    return rendered === "{}" ? "unknown" : rendered;
};

const fail = (pathLabel: string, message: string): never => {
    throw new TypegenRenderError(pathLabel, message);
};

const getPropertyAssignment = (objectLiteral: ts.ObjectLiteralExpression, name: string) =>
    objectLiteral.properties.find((property) => {
        if (
            !ts.isPropertyAssignment(property) &&
            !ts.isShorthandPropertyAssignment(property) &&
            !ts.isMethodDeclaration(property)
        ) {
            return false;
        }

        const propertyName =
            ts.isShorthandPropertyAssignment(property) || ts.isMethodDeclaration(property)
                ? property.name.getText()
                : ts.isIdentifier(property.name) ||
                    ts.isStringLiteral(property.name) ||
                    ts.isNumericLiteral(property.name)
                  ? property.name.text
                  : property.name.getText();

        return propertyName === name;
    });

const resolvePropertyExpression = (
    objectLiteral: ts.ObjectLiteralExpression,
    name: string,
): ts.Expression | undefined => {
    const property = getPropertyAssignment(objectLiteral, name);
    if (!property) return undefined;
    if (ts.isPropertyAssignment(property)) return property.initializer;
    if (ts.isShorthandPropertyAssignment(property)) return property.name;
    return undefined;
};

const getSymbolExpression = (
    checker: ts.TypeChecker,
    expression: ts.Expression,
): ts.Expression | undefined => {
    let symbol =
        ts.isIdentifier(expression) && ts.isShorthandPropertyAssignment(expression.parent)
            ? checker.getShorthandAssignmentValueSymbol(expression.parent)
            : checker.getSymbolAtLocation(expression);
    if (!symbol) return undefined;

    // Imported/re-exported values are often alias symbols, resolve them to the underlying value symbol.
    while (symbol.flags & ts.SymbolFlags.Alias) {
        const aliased = checker.getAliasedSymbol(symbol);
        if (!aliased || aliased === symbol) break;
        symbol = aliased;
    }

    const declaration = symbol?.valueDeclaration ?? symbol?.declarations?.[0];
    if (!declaration) return undefined;

    if (ts.isVariableDeclaration(declaration)) {
        return declaration.initializer
            ? ts.isAsExpression(declaration.initializer) ||
              ts.isTypeAssertionExpression(declaration.initializer)
                ? declaration.initializer
                : declaration.initializer
            : undefined;
    }
    if (ts.isPropertyAssignment(declaration)) return declaration.initializer;
    if (ts.isShorthandPropertyAssignment(declaration)) return declaration.name;
    if (ts.isExportAssignment(declaration)) return declaration.expression;
    return undefined;
};

const resolveExpressionReference = (
    checker: ts.TypeChecker,
    expression: ts.Expression,
    seen = new Set<ts.Node>(),
): ts.Expression => {
    let current = unwrapExpression(expression);

    while (ts.isIdentifier(current) || ts.isPropertyAccessExpression(current)) {
        if (seen.has(current)) return current;
        seen.add(current);

        const resolved = getSymbolExpression(checker, current);
        if (!resolved) return current;
        current = unwrapExpression(resolved);
    }

    return current;
};

const findPropertyInType = (
    checker: ts.TypeChecker,
    type: ts.Type,
    name: string,
): { declaration: ts.Declaration | undefined; symbol: ts.Symbol; type: ts.Type } | undefined => {
    const property = checker.getPropertyOfType(type, name);
    if (!property) return undefined;
    const declaration = property.valueDeclaration ?? property.declarations?.[0];
    if (!declaration) return undefined;
    return {
        declaration,
        symbol: property,
        type: checker.getTypeOfSymbolAtLocation(property, declaration),
    };
};

const OMIT_MODEL_OPTION_KEYS = new Set([
    "input",
    "tools",
    "toolChoice",
    "structured_output",
    "modalities",
    "instructions",
    "text",
]);

const extractPortableObjectNodeFromProperties = (
    checker: ts.TypeChecker,
    type: ts.Type,
    pathLabel: string,
    properties: ts.Symbol[],
    seen = new Set<ts.Type>(),
): PortableNode => {
    const nextSeen = new Set([...seen, type]);
    return {
        kind: "object",
        properties: properties.map((property) => {
            const declaration = property.valueDeclaration ?? property.declarations?.[0];
            if (!declaration)
                return fail(`${pathLabel}.${property.getName()}`, "missing declaration");
            return {
                name: property.getName(),
                optional: (property.flags & ts.SymbolFlags.Optional) !== 0,
                value: extractPortableNodeFromType(
                    checker,
                    checker.getTypeOfSymbolAtLocation(property, declaration),
                    `${pathLabel}.${property.getName()}`,
                    nextSeen,
                ),
            };
        }),
    };
};

const extractModelOptionsNodeFromType = (
    checker: ts.TypeChecker,
    modelType: ts.Type,
    pathLabel: string,
): PortableNode | undefined => {
    const options = findPropertyInType(checker, modelType, "options");
    if (options) {
        const optionsProperties = checker
            .getPropertiesOfType(options.type)
            .filter((property) => !OMIT_MODEL_OPTION_KEYS.has(property.getName()));
        if (optionsProperties.length === 0) {
            return { kind: "object", properties: [] } satisfies PortableNode;
        }
        return extractPortableObjectNodeFromProperties(
            checker,
            options.type,
            `${pathLabel}.options`,
            optionsProperties,
        );
    }

    const getOptionsFromMethod = (methodName: "doGenerate" | "doGenerateStream") => {
        const method = findPropertyInType(checker, modelType, methodName);
        if (!method?.declaration) return undefined;

        const methodType = checker.getTypeOfSymbolAtLocation(method.symbol, method.declaration);
        const callableType = checker.getNonNullableType(methodType);
        const signature = checker.getSignaturesOfType(callableType, ts.SignatureKind.Call)[0];
        const parameter = signature?.getParameters()[0];
        const parameterDeclaration = parameter?.valueDeclaration ?? parameter?.declarations?.[0];
        if (!parameter || !parameterDeclaration) return undefined;

        const parameterType = checker.getTypeOfSymbolAtLocation(parameter, parameterDeclaration);
        const optionProperties = checker
            .getPropertiesOfType(parameterType)
            .filter((property) => !OMIT_MODEL_OPTION_KEYS.has(property.getName()));

        if (optionProperties.length === 0) {
            return { kind: "object", properties: [] } satisfies PortableNode;
        }

        return extractPortableObjectNodeFromProperties(
            checker,
            parameterType,
            `${pathLabel}.options`,
            optionProperties,
        );
    };

    return getOptionsFromMethod("doGenerate") ?? getOptionsFromMethod("doGenerateStream");
};

const dedupeUnionMembers = (members: PortableNode[]) => {
    const seen = new Set<string>();
    const deduped: PortableNode[] = [];
    for (const member of members) {
        const key = renderPortableNode(member);
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(member);
    }
    return deduped;
};

const getStandardTypesInputType = (
    checker: ts.TypeChecker,
    schemaType: ts.Type,
): ts.Type | undefined => {
    const apparentType = checker.getApparentType(checker.getNonNullableType(schemaType));
    const standard = findPropertyInType(checker, apparentType, "~standard");
    if (!standard) return undefined;

    const types = findPropertyInType(checker, standard.type, "types");
    if (!types) return undefined;

    const typesType = checker.getApparentType(checker.getNonNullableType(types.type));
    return findPropertyInType(checker, typesType, "input")?.type;
};

const hasStandardSchemaShape = (checker: ts.TypeChecker, schemaType: ts.Type): boolean =>
    !!findPropertyInType(
        checker,
        checker.getApparentType(checker.getNonNullableType(schemaType)),
        "~standard",
    );

const extractPortableNodeFromType = (
    checker: ts.TypeChecker,
    type: ts.Type,
    pathLabel: string,
    seen = new Set<ts.Type>(),
): PortableNode => {
    if (seen.has(type)) {
        const rendered = formatCallableType(checker, type);
        switch (rendered) {
            case "string":
            case "number":
            case "boolean":
            case "unknown":
                return { kind: "keyword", value: rendered };
            case "null":
                return { kind: "literal", value: null };
            case "undefined":
                return { kind: "keyword", value: "undefined" };
            default:
                fail(pathLabel, `unsupported recursive type: ${rendered}`);
        }
    }

    if (type.isStringLiteral()) return { kind: "literal", value: type.value };
    if (type.isNumberLiteral()) return { kind: "literal", value: type.value };
    if (type.flags & ts.TypeFlags.BooleanLiteral) {
        return {
            kind: "literal",
            value: checker.typeToString(type) === "true",
        };
    }
    if (type.flags & ts.TypeFlags.Null) return { kind: "literal", value: null };
    if (type.flags & ts.TypeFlags.Undefined) return { kind: "keyword", value: "undefined" };
    if (type.flags & ts.TypeFlags.String) return { kind: "keyword", value: "string" };
    if (type.flags & ts.TypeFlags.Number) return { kind: "keyword", value: "number" };
    if (type.flags & ts.TypeFlags.Boolean) return { kind: "keyword", value: "boolean" };
    if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) {
        return { kind: "keyword", value: "unknown" };
    }

    if (type.isUnion()) {
        return {
            kind: "union",
            members: dedupeUnionMembers(
                type.types.map((member, index) =>
                    extractPortableNodeFromType(
                        checker,
                        member,
                        `${pathLabel}|${index + 1}`,
                        new Set([...seen, type]),
                    ),
                ),
            ),
        };
    }

    if (checker.isTupleType(type)) {
        const typeReference = type as ts.TypeReference;
        return {
            kind: "tuple",
            readonly: true,
            elements: checker
                .getTypeArguments(typeReference)
                .map((entry, index) =>
                    extractPortableNodeFromType(
                        checker,
                        entry,
                        `${pathLabel}[${index}]`,
                        new Set([...seen, type]),
                    ),
                ),
        };
    }

    if (checker.isArrayType(type)) {
        const typeReference = type as ts.TypeReference;
        const [element] = checker.getTypeArguments(typeReference);
        if (!element) return fail(pathLabel, "unsupported array element type");
        return {
            kind: "array",
            readonly: true,
            element: extractPortableNodeFromType(
                checker,
                element,
                `${pathLabel}[]`,
                new Set([...seen, type]),
            ),
        };
    }

    const properties = checker.getPropertiesOfType(type);
    if (properties.length === 0) {
        const rendered = formatCallableType(checker, type);
        if (
            rendered.includes("[x: string]") ||
            rendered.includes("[x:string]") ||
            rendered === "{}"
        ) {
            return { kind: "keyword", value: "unknown" };
        }
        fail(pathLabel, `unsupported type: ${rendered}`);
    }

    const nextSeen = new Set([...seen, type]);
    return {
        kind: "object",
        properties: properties.map((property) => {
            const declaration = property.valueDeclaration ?? property.declarations?.[0];
            if (!declaration)
                return fail(`${pathLabel}.${property.getName()}`, "missing declaration");
            return {
                name: property.getName(),
                optional: (property.flags & ts.SymbolFlags.Optional) !== 0,
                value: extractPortableNodeFromType(
                    checker,
                    checker.getTypeOfSymbolAtLocation(property, declaration),
                    `${pathLabel}.${property.getName()}`,
                    nextSeen,
                ),
            };
        }),
    };
};

const extractPortableNodeFromTypeNode = (
    checker: ts.TypeChecker,
    typeNode: ts.TypeNode,
    pathLabel: string,
) => extractPortableNodeFromType(checker, checker.getTypeFromTypeNode(typeNode), pathLabel);

const extractPortableSchemaNodeFromExpression = (
    context: ExtractContext,
    expression: ts.Expression,
): PortableNode => {
    const current = resolveExpressionReference(context.checker, expression);
    const schemaType = context.checker.getTypeAtLocation(current);
    const standardInputType = getStandardTypesInputType(context.checker, schemaType);

    if (standardInputType) {
        return extractPortableNodeFromType(
            context.checker,
            standardInputType,
            `${context.path}.~standard.types.input`,
        );
    }

    if (hasStandardSchemaShape(context.checker, schemaType)) {
        return fail(
            context.path,
            "standard schema must expose '~standard.types.input' for portable type generation",
        );
    }

    return extractPortableNodeFromExpression(context, current);
};

const extractPortableNodeFromExpression = (
    context: ExtractContext,
    expression: ts.Expression,
    mode: "strict" | "type-fallback" = "strict",
): PortableNode => {
    const current = unwrapExpression(expression);

    if (ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression)) {
        return extractPortableNodeFromTypeNode(context.checker, expression.type, context.path);
    }

    if (isLiteralLike(current)) {
        if (ts.isStringLiteralLike(current)) return { kind: "literal", value: current.text };
        if (ts.isNumericLiteral(current)) return { kind: "literal", value: Number(current.text) };
        if (current.kind === ts.SyntaxKind.TrueKeyword) return { kind: "literal", value: true };
        if (current.kind === ts.SyntaxKind.FalseKeyword) return { kind: "literal", value: false };
        return { kind: "literal", value: null };
    }

    if (ts.isObjectLiteralExpression(current)) {
        const properties: PortableProperty[] = [];

        for (const property of current.properties) {
            if (ts.isSpreadAssignment(property)) {
                fail(
                    context.path,
                    "spread properties are not supported in portable type generation",
                );
            }
            if (ts.isMethodDeclaration(property)) continue;

            let name: string;
            let initializer: ts.Expression;

            if (ts.isPropertyAssignment(property)) {
                name =
                    ts.isIdentifier(property.name) ||
                    ts.isStringLiteral(property.name) ||
                    ts.isNumericLiteral(property.name)
                        ? property.name.text
                        : property.name.getText();
                initializer = property.initializer;
            } else if (ts.isShorthandPropertyAssignment(property)) {
                name = property.name.text;
                initializer = property.name;
            } else {
                continue;
            }

            properties.push({
                name,
                value: extractPortableNodeFromExpression(
                    { checker: context.checker, path: `${context.path}.${name}` },
                    initializer,
                    mode,
                ),
            });
        }

        return { kind: "object", properties };
    }

    if (ts.isArrayLiteralExpression(current)) {
        return {
            kind: "tuple",
            readonly: true,
            elements: current.elements.map((element, index) => {
                if (ts.isSpreadElement(element)) {
                    fail(`${context.path}[${index}]`, "spread elements are not supported");
                }
                return extractPortableNodeFromExpression(
                    { checker: context.checker, path: `${context.path}[${index}]` },
                    element,
                    mode,
                );
            }),
        };
    }

    if (ts.isIdentifier(current) || ts.isPropertyAccessExpression(current)) {
        const resolved = getSymbolExpression(context.checker, current);
        if (resolved) {
            return extractPortableNodeFromExpression(context, resolved, mode);
        }
    }

    if (ts.isCallExpression(current)) {
        const firstArg = current.arguments[0];
        if (firstArg && ts.isObjectLiteralExpression(unwrapExpression(firstArg))) {
            return extractPortableNodeFromExpression(context, firstArg, mode);
        }

        if (mode === "type-fallback") {
            return extractPortableNodeFromType(
                context.checker,
                context.checker.getTypeAtLocation(current),
                context.path,
            );
        }
    }

    if (mode === "type-fallback") {
        return extractPortableNodeFromType(
            context.checker,
            context.checker.getTypeAtLocation(current),
            context.path,
        );
    }

    return fail(context.path, `unsupported expression: ${current.getText()}`);
};

const extractOutputSchemaNode = (
    checker: ts.TypeChecker,
    expression: ts.Expression,
    pathLabel: string,
): PortableNode => {
    const current = resolveExpressionReference(checker, expression);
    if (!ts.isObjectLiteralExpression(current)) {
        return fail(pathLabel, "outputSchema must resolve to an object literal");
    }

    const schemaExpression = resolvePropertyExpression(current, "schema");
    if (!schemaExpression) {
        return fail(pathLabel, "outputSchema is missing 'schema'");
    }

    const properties: PortableProperty[] = [
        {
            name: "schema",
            value: extractPortableSchemaNodeFromExpression(
                { checker, path: `${pathLabel}.schema` },
                schemaExpression,
            ),
        },
    ];

    const nameExpression = resolvePropertyExpression(current, "name");
    if (nameExpression) {
        properties.push({
            name: "name",
            value: extractPortableNodeFromExpression(
                { checker, path: `${pathLabel}.name` },
                nameExpression,
                "type-fallback",
            ),
        });
    }

    const strictExpression = resolvePropertyExpression(current, "strict");
    if (strictExpression) {
        properties.push({
            name: "strict",
            value: extractPortableNodeFromExpression(
                { checker, path: `${pathLabel}.strict` },
                strictExpression,
                "type-fallback",
            ),
        });
    }

    return {
        kind: "object",
        properties,
    };
};

const extractAppConfigObject = (
    checker: ts.TypeChecker,
    declaration: ts.Declaration,
    label: string,
): ts.ObjectLiteralExpression => {
    const fromExpression = (expression: ts.Expression): ts.ObjectLiteralExpression | undefined => {
        const current = unwrapExpression(expression);

        if (ts.isObjectLiteralExpression(current)) {
            const configExpr = resolvePropertyExpression(current, "config");
            if (!configExpr) return undefined;
            const configCurrent = unwrapExpression(configExpr);
            return ts.isObjectLiteralExpression(configCurrent) ? configCurrent : undefined;
        }

        if (ts.isCallExpression(current)) {
            const firstArg = current.arguments[0];
            if (!firstArg) return undefined;
            const configCurrent = unwrapExpression(firstArg);
            return ts.isObjectLiteralExpression(configCurrent) ? configCurrent : undefined;
        }

        if (ts.isIdentifier(current) || ts.isPropertyAccessExpression(current)) {
            const resolved = getSymbolExpression(checker, current);
            return resolved ? fromExpression(resolved) : undefined;
        }

        return undefined;
    };

    const expression =
        ts.isVariableDeclaration(declaration) && declaration.initializer
            ? declaration.initializer
            : ts.isExportAssignment(declaration)
              ? declaration.expression
              : undefined;

    const configObject = expression ? fromExpression(expression) : undefined;
    if (!configObject) {
        return fail(label, "unable to locate a portable app config object");
    }
    return configObject;
};

const extractRequiredObjectProperty = (
    objectLiteral: ts.ObjectLiteralExpression,
    name: string,
    checker: ts.TypeChecker,
    pathLabel: string,
) => {
    const expression = resolvePropertyExpression(objectLiteral, name);
    if (!expression) return fail(pathLabel, `missing required property '${name}'`);
    return { checker, expression: unwrapExpression(expression), path: `${pathLabel}.${name}` };
};

const extractOptionalObjectProperty = (
    objectLiteral: ts.ObjectLiteralExpression,
    name: string,
    checker: ts.TypeChecker,
    pathLabel: string,
) => {
    const expression = resolvePropertyExpression(objectLiteral, name);
    return expression
        ? { checker, expression: unwrapExpression(expression), path: `${pathLabel}.${name}` }
        : undefined;
};

const extractClientToolNode = (
    checker: ts.TypeChecker,
    expression: ts.Expression,
    pathLabel: string,
): PortableNode | undefined => {
    const current = unwrapExpression(expression);

    if (ts.isIdentifier(current) || ts.isPropertyAccessExpression(current)) {
        const resolved = getSymbolExpression(checker, current);
        return resolved ? extractClientToolNode(checker, resolved, pathLabel) : undefined;
    }

    if (ts.isObjectLiteralExpression(current)) {
        const kindExpression = resolvePropertyExpression(current, "kind");
        const kindNode = kindExpression
            ? extractPortableNodeFromExpression(
                  { checker, path: `${pathLabel}.kind` },
                  kindExpression,
                  "type-fallback",
              )
            : undefined;

        if (
            !kindNode ||
            kindNode.kind !== "literal" ||
            typeof kindNode.value !== "string" ||
            kindNode.value !== "client"
        ) {
            return undefined;
        }

        const nameExpression = resolvePropertyExpression(current, "name");
        const schemaExpression = resolvePropertyExpression(current, "schema");
        if (!nameExpression || !schemaExpression) {
            return fail(pathLabel, "client tool is missing 'name' or 'schema'");
        }

        return {
            kind: "object",
            properties: [
                {
                    name: "kind",
                    value: { kind: "literal", value: "client" },
                },
                {
                    name: "name",
                    value: extractPortableNodeFromExpression(
                        { checker, path: `${pathLabel}.name` },
                        nameExpression,
                        "type-fallback",
                    ),
                },
                {
                    name: "schema",
                    value: extractPortableSchemaNodeFromExpression(
                        { checker, path: `${pathLabel}.schema` },
                        schemaExpression,
                    ),
                },
            ],
        };
    }

    if (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression)) {
        const methodName = current.expression.name.text;
        if (methodName === "client") {
            const baseCall = resolveExpressionReference(checker, current.expression.expression);
            if (ts.isCallExpression(baseCall)) {
                const configArg = baseCall.arguments[0];
                const configObject =
                    configArg && ts.isObjectLiteralExpression(unwrapExpression(configArg))
                        ? (unwrapExpression(configArg) as ts.ObjectLiteralExpression)
                        : undefined;

                if (configObject) {
                    const nameExpression = resolvePropertyExpression(configObject, "name");
                    const schemaExpression = resolvePropertyExpression(configObject, "schema");
                    if (!nameExpression || !schemaExpression) {
                        return fail(
                            pathLabel,
                            "defineTool(...).client() is missing 'name' or 'schema'",
                        );
                    }

                    return {
                        kind: "object",
                        properties: [
                            { name: "kind", value: { kind: "literal", value: "client" } },
                            {
                                name: "name",
                                value: extractPortableNodeFromExpression(
                                    { checker, path: `${pathLabel}.name` },
                                    nameExpression,
                                    "type-fallback",
                                ),
                            },
                            {
                                name: "schema",
                                value: extractPortableSchemaNodeFromExpression(
                                    { checker, path: `${pathLabel}.schema` },
                                    schemaExpression,
                                ),
                            },
                        ],
                    };
                }
            }
        }
    }

    const toolType = checker.getTypeAtLocation(current);
    const kindProperty = findPropertyInType(checker, toolType, "kind");
    if (!kindProperty) return undefined;

    const kindNode = extractPortableNodeFromType(checker, kindProperty.type, `${pathLabel}.kind`);
    if (
        kindNode.kind !== "literal" ||
        typeof kindNode.value !== "string" ||
        kindNode.value !== "client"
    ) {
        return undefined;
    }

    const nameProperty = findPropertyInType(checker, toolType, "name");
    const schemaProperty = findPropertyInType(checker, toolType, "schema");
    if (!nameProperty || !schemaProperty) {
        return fail(pathLabel, "client tool type is missing 'name' or 'schema'");
    }

    return {
        kind: "object",
        properties: [
            { name: "kind", value: { kind: "literal", value: "client" } },
            {
                name: "name",
                value: extractPortableNodeFromType(checker, nameProperty.type, `${pathLabel}.name`),
            },
            {
                name: "schema",
                value: extractPortableNodeFromType(
                    checker,
                    schemaProperty.type,
                    `${pathLabel}.schema`,
                ),
            },
        ],
    };
};

const extractToolsNode = (
    checker: ts.TypeChecker,
    expression: ts.Expression,
    pathLabel: string,
): PortableNode => {
    const current = resolveExpressionReference(checker, expression);
    if (!ts.isArrayLiteralExpression(current)) {
        return fail(pathLabel, "tools must be declared as an array literal");
    }

    const clientTools = current.elements.flatMap((element, index) => {
        if (ts.isSpreadElement(element)) {
            return fail(`${pathLabel}[${index}]`, "spread tools are not supported");
        }

        const toolNode = extractClientToolNode(checker, element, `${pathLabel}[${index}]`);
        return toolNode ? [toolNode] : [];
    });

    return {
        kind: "tuple",
        readonly: true,
        elements: clientTools,
    };
};

const extractAgentNode = (
    checker: ts.TypeChecker,
    expression: ts.Expression,
    pathLabel: string,
): PortableNode => {
    const current = unwrapExpression(expression);
    const resolved =
        ts.isIdentifier(current) || ts.isPropertyAccessExpression(current)
            ? getSymbolExpression(checker, current)
            : current;
    const target = resolved ? unwrapExpression(resolved) : current;

    const agentObject = ts.isCallExpression(target)
        ? target.arguments[0]
        : ts.isObjectLiteralExpression(target)
          ? target
          : undefined;

    if (!agentObject || !ts.isObjectLiteralExpression(unwrapExpression(agentObject))) {
        return fail(pathLabel, "agents must resolve to object literals or defineAgent(...) calls");
    }

    const objectLiteral = unwrapExpression(agentObject) as ts.ObjectLiteralExpression;
    const nameSource = extractRequiredObjectProperty(objectLiteral, "name", checker, pathLabel);
    const modelSource = extractRequiredObjectProperty(objectLiteral, "model", checker, pathLabel);
    const contextSchemaSource = extractOptionalObjectProperty(
        objectLiteral,
        "contextSchema",
        checker,
        pathLabel,
    );
    const outputSchemaSource = extractOptionalObjectProperty(
        objectLiteral,
        "outputSchema",
        checker,
        pathLabel,
    );
    const toolsSource = extractOptionalObjectProperty(objectLiteral, "tools", checker, pathLabel);

    const modelNode = (() => {
        const modelProperties: PortableProperty[] = [];
        const currentModel = unwrapExpression(modelSource.expression);
        if (ts.isObjectLiteralExpression(currentModel)) {
            const providerIdExpr = resolvePropertyExpression(currentModel, "providerId");
            if (providerIdExpr) {
                modelProperties.push({
                    name: "providerId",
                    value: extractPortableNodeFromExpression(
                        { checker, path: `${pathLabel}.model.providerId` },
                        providerIdExpr,
                        "type-fallback",
                    ),
                });
            }

            const modelIdExpr = resolvePropertyExpression(currentModel, "modelId");
            if (modelIdExpr) {
                modelProperties.push({
                    name: "modelId",
                    value: extractPortableNodeFromExpression(
                        { checker, path: `${pathLabel}.model.modelId` },
                        modelIdExpr,
                        "type-fallback",
                    ),
                });
            }

            const optionsExpr = resolvePropertyExpression(currentModel, "options");
            if (optionsExpr) {
                const rawOptions = extractPortableNodeFromExpression(
                    { checker, path: `${pathLabel}.model.options` },
                    optionsExpr,
                    "type-fallback",
                );
                // Filter out keys that are managed and have agnostic equivalents.
                const filteredOptions =
                    rawOptions.kind === "object"
                        ? {
                              ...rawOptions,
                              properties: rawOptions.properties.filter(
                                  (p) => !OMIT_MODEL_OPTION_KEYS.has(p.name),
                              ),
                          }
                        : rawOptions;
                modelProperties.push({
                    name: "options",
                    value: filteredOptions,
                });
            } else {
                const optionsNode = extractModelOptionsNodeFromType(
                    checker,
                    checker.getTypeAtLocation(currentModel),
                    `${pathLabel}.model`,
                );
                if (optionsNode) {
                    modelProperties.push({
                        name: "options",
                        value: optionsNode,
                    });
                }
            }

            const capsExpr = resolvePropertyExpression(currentModel, "caps");
            if (!capsExpr) return fail(`${pathLabel}.model`, "model is missing 'caps'");
            modelProperties.push({
                name: "caps",
                value: extractPortableNodeFromExpression(
                    { checker, path: `${pathLabel}.model.caps` },
                    capsExpr,
                    "type-fallback",
                ),
            });

            return {
                kind: "object",
                properties: modelProperties,
            } satisfies PortableNode;
        }

        const modelType = checker.getTypeAtLocation(currentModel);
        const providerId = findPropertyInType(checker, modelType, "providerId");
        if (providerId) {
            modelProperties.push({
                name: "providerId",
                value: extractPortableNodeFromType(
                    checker,
                    providerId.type,
                    `${pathLabel}.model.providerId`,
                ),
            });
        }

        const modelId = findPropertyInType(checker, modelType, "modelId");
        if (modelId) {
            modelProperties.push({
                name: "modelId",
                value: extractPortableNodeFromType(
                    checker,
                    modelId.type,
                    `${pathLabel}.model.modelId`,
                ),
            });
        }

        const optionsNode = extractModelOptionsNodeFromType(
            checker,
            modelType,
            `${pathLabel}.model`,
        );
        if (optionsNode) {
            modelProperties.push({
                name: "options",
                value: optionsNode,
            });
        }

        const caps = findPropertyInType(checker, modelType, "caps");
        if (!caps) return fail(`${pathLabel}.model`, "model type is missing 'caps'");
        modelProperties.push({
            name: "caps",
            value: extractPortableNodeFromType(checker, caps.type, `${pathLabel}.model.caps`),
        });

        return {
            kind: "object",
            properties: modelProperties,
        } satisfies PortableNode;
    })();

    const properties: PortableProperty[] = [
        {
            name: "name",
            value: extractPortableNodeFromExpression(
                { checker, path: `${pathLabel}.name` },
                nameSource.expression,
            ),
        },
        { name: "model", value: modelNode },
    ];

    if (contextSchemaSource) {
        properties.push({
            name: "contextSchema",
            value: extractPortableSchemaNodeFromExpression(
                { checker, path: contextSchemaSource.path },
                contextSchemaSource.expression,
            ),
        });
    }

    if (outputSchemaSource) {
        properties.push({
            name: "outputSchema",
            value: extractOutputSchemaNode(
                checker,
                outputSchemaSource.expression,
                outputSchemaSource.path,
            ),
        });
    }

    if (toolsSource) {
        properties.push({
            name: "tools",
            value: extractToolsNode(checker, toolsSource.expression, toolsSource.path),
        });
    }

    return { kind: "object", properties };
};

const extractAgentsNode = (
    checker: ts.TypeChecker,
    expression: ts.Expression,
    pathLabel: string,
): PortableNode => {
    const current = resolveExpressionReference(checker, expression);
    if (!ts.isArrayLiteralExpression(current)) {
        return fail(pathLabel, "agents must be declared as an array literal");
    }

    return {
        kind: "tuple",
        readonly: true,
        elements: current.elements.map((element: ts.Expression, index: number) => {
            if (ts.isSpreadElement(element)) {
                return fail(`${pathLabel}[${index}]`, "spread agents are not supported");
            }
            return extractAgentNode(checker, element, `${pathLabel}[${index}]`);
        }),
    };
};

const extractAppToolsNode = (
    checker: ts.TypeChecker,
    expression: ts.Expression,
    pathLabel: string,
): PortableNode => extractToolsNode(checker, expression, pathLabel);

const extractPortableAppNode = (
    checker: ts.TypeChecker,
    declaration: ts.Declaration,
    label: string,
): PortableNode => {
    const configObject = extractAppConfigObject(checker, declaration, label);
    const agentsSource = extractRequiredObjectProperty(
        configObject,
        "agents",
        checker,
        `${label}.config`,
    );
    const toolsSource = extractOptionalObjectProperty(
        configObject,
        "tools",
        checker,
        `${label}.config`,
    );

    const configProperties: PortableProperty[] = [
        {
            name: "agents",
            value: extractAgentsNode(checker, agentsSource.expression, agentsSource.path),
        },
    ];

    if (toolsSource) {
        configProperties.push({
            name: "tools",
            value: extractAppToolsNode(checker, toolsSource.expression, toolsSource.path),
        });
    }

    return {
        kind: "object",
        properties: [
            {
                name: "config",
                value: {
                    kind: "object",
                    properties: configProperties,
                },
            },
        ],
    };
};

export const toTypeIdentifier = (raw: string) => {
    const cleaned = raw.replace(/[^A-Za-z0-9_$]/g, "_");
    if (!cleaned) return DEFAULT_TYPE_NAME;
    return /^[0-9]/.test(cleaned) ? `_${cleaned}` : cleaned;
};

const createUniqueTypeNames = (baseName: string, labels: string[]) => {
    const used = new Set<string>();
    return labels.map((label, index) => {
        const preferred = toTypeIdentifier(
            labels.length === 1 ? baseName : `${baseName}_${label.replace(/[:/\\.]/g, "_")}`,
        );
        if (!used.has(preferred)) {
            used.add(preferred);
            return preferred;
        }
        let suffix = index + 1;
        let candidate = `${preferred}_${suffix}`;
        while (used.has(candidate)) {
            suffix += 1;
            candidate = `${preferred}_${suffix}`;
        }
        used.add(candidate);
        return candidate;
    });
};

export const renderTypegenOutput = (apps: TypegenAppReference[], baseName: string): string => {
    const program = ts.createProgram(
        [...new Set(apps.map((app) => app.configFile))],
        loadCompilerOptions(apps.map((app) => app.configFile)),
    );
    const checker = program.getTypeChecker();

    const typeNames = createUniqueTypeNames(
        baseName,
        apps.map((app) => app.label),
    );

    const sections = apps.map((app, index) => {
        const sourceFile = program.getSourceFile(app.configFile);
        if (!sourceFile) {
            throw new Error(`Unable to load TypeScript source for ${app.configFile}`);
        }

        const exportSymbol = getExportSymbol(checker, sourceFile, app.exportPath);
        if (!exportSymbol) {
            throw new Error(
                `Unable to resolve export ${app.exportPath.join(".")} in ${app.configFile}`,
            );
        }

        const declaration = exportSymbol.valueDeclaration ?? exportSymbol.declarations?.[0];
        if (!declaration) {
            throw new Error(`Unable to resolve declaration for ${app.label}`);
        }

        const typeName = typeNames[index] ?? baseName;
        const appNode = extractPortableAppNode(checker, declaration, app.label);
        return renderTypeAlias(typeName, appNode, app.label);
    });

    return sections.join("\n\n");
};
