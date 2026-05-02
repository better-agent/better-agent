import { defineEventHandler, toWebRequest } from "h3";
import app from "~~/lib/better-agent/server";

export default defineEventHandler((event) => app.handler(toWebRequest(event)));
