import { AppError } from "./index.js";

function normalizeYouTubeUrl(url) {
    const parsed = new URL(url);
    let videoId = "";
    if (parsed.hostname === "youtu.be") {
        videoId = parsed.pathname.split("/").filter(Boolean)[0] || "";
    }
    if (
        parsed.hostname.includes("youtube.com") ||
        parsed.hostname.includes("youtube-nocookie.com")
    ) {
        if (parsed.pathname === "/watch") {
            videoId = parsed.searchParams.get("v") || "";
        }
        if (parsed.pathname.startsWith("/shorts/")) {
            videoId = parsed.pathname.split("/")[2] || "";
        }
        if (parsed.pathname.startsWith("/embed/")) {
            videoId = parsed.pathname.split("/")[2] || "";
        }
    }
    if (!videoId) return null;
    return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}`;
}

function normalizeInstagramUrl(url) {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("instagram.com")) return null;

    const match = parsed.pathname.match(/^\/(reel|reels|p|tv)\/([^/]+)/);
    if (!match) return null;

    const type = match[1] === "reels" ? "reel" : match[1];
    const id = match[2];
    return `https://www.instagram.com/${type}/${id}/embed/`;
}

function normalizeTikTokDirectUrl(url) {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();
    if (hostname !== "tiktok.com" && !hostname.endsWith(".tiktok.com")) return null;

    const playerMatch = parsed.pathname.match(/^\/player\/v1\/(\d+)/);
    if (playerMatch) return `https://www.tiktok.com/player/v1/${playerMatch[1]}`;

    const videoMatch = parsed.pathname.match(/\/video\/(\d+)/);
    if (!videoMatch) return null;

    return `https://www.tiktok.com/player/v1/${videoMatch[1]}`;
}

async function resolveTikTokShortUrl(url) {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const isShortTikTok = hostname === "vt.tiktok.com" || hostname === "vm.tiktok.com";
    if (!isShortTikTok) return url;
    try {
        const response = await fetch(url, {
            method: "GET",
            redirect: "follow",
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " + "AppleWebKit/537.36 (KHTML, like Gecko) " + "Chrome/140.0.0.0 Safari/537.36",
            },
        });
        if (!response.url) throw new Error("TikTok redirect URL not found");
        return response.url;
    } catch (error) {
        console.error("TikTok short URL resolve error:", error);
        throw new AppError("Could not resolve TikTok short URL", 400);
    }
}
export async function normalizeVideoUrl(rawUrl) {
    if (!rawUrl || !String(rawUrl).trim()) return "";

    let value = String(rawUrl).trim();
    if (!/^https?:\/\//i.test(value)) {
        value = `https://${value}`;
    }
    let parsed;
    try {
        parsed = new URL(value);
    } catch {
        throw new AppError("Invalid video URL", 400);
    }
    if (!["http:", "https:"].includes(parsed.protocol)) throw new AppError("Invalid video URL protocol", 400);

    const youtube = normalizeYouTubeUrl(value);
    if (youtube) return youtube;

    const instagram = normalizeInstagramUrl(value);
    if (instagram) return instagram;

    const resolvedTikTokUrl = await resolveTikTokShortUrl(value);
    const tiktok = normalizeTikTokDirectUrl(resolvedTikTokUrl);
    if (tiktok) return tiktok;

    throw new AppError("Only Instagram, TikTok and YouTube video links are supported", 400);
}