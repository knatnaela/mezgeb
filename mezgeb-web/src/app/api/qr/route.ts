import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  const format = (searchParams.get("format") || "svg").toLowerCase();
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  const galleryUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL}/g/${slug}`;

  if (format === "png") {
    const dataUrl = await QRCode.toDataURL(galleryUrl, { margin: 1, scale: 8, color: { dark: "#000000", light: "#ffffffff" } });
    const base64 = dataUrl.split(",")[1];
    return new NextResponse(Buffer.from(base64, "base64"), {
      headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000, immutable" },
    });
  }

  const svg = await QRCode.toString(galleryUrl, { type: "svg", margin: 1, color: { dark: "#000", light: "#fff" } });
  return new NextResponse(svg, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=31536000, immutable" },
  });
}


