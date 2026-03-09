import { type ImgHTMLAttributes } from "react";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

type ImageProps = ImgHTMLAttributes<HTMLImageElement> & { alt: string };

export default function Image(props: ImageProps) {
    let src = props.src;
    if (typeof src === "string" && !src.startsWith(basePath) && src.startsWith("/")) {
        src = `${basePath}${src}`;
    }
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- alt is required via TypeScript props
    return <img {...props} src={src} />;
}
