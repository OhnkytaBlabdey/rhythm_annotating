import NextImage, { ImageProps } from "next/image";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export default function Image(props: ImageProps) {
    let src = props.src;
    if (typeof src === "string" && !src.startsWith(basePath) && src.startsWith("/")) {
        src = `${basePath}${src}`;
    }
    return <NextImage {...props} src={src} />;
}
