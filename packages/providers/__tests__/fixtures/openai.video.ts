export const VIDEO_FIXTURE = {
    modelId: "sora-2" as const,
    prompt: "Blue dot moves on white background.",
    size: "720x1280" as const,
    seconds: "4" as const,
    videoId: "vid_fixture_123",
    videoBytes: "mock-video-bytes",
};

export const VIDEO_BASE_PAYLOAD = {
    object: "video" as const,
    model: VIDEO_FIXTURE.modelId,
    created_at: 1700000000,
    completed_at: null as number | null,
    expires_at: null as number | null,
    prompt: VIDEO_FIXTURE.prompt,
    size: VIDEO_FIXTURE.size,
    seconds: VIDEO_FIXTURE.seconds,
    remixed_from_video_id: null as string | null,
    error: null as { code: string; message: string } | null,
};
