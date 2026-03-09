import { type ImgHTMLAttributes } from "react";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export default function Image(props: ImgHTMLAttributes<HTMLImageElement>) {
    let src = props.src;
    if (typeof src === "string" && !src.startsWith(basePath) && src.startsWith("/")) {
        src = `${basePath}${src}`;
    }
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} src={src} />;
}
