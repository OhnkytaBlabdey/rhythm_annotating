import NextImage, { ImageProps } from "next/image";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export default function Image(props: ImageProps) {
    const src =
        typeof props.src === "string" ? `${basePath}${props.src}` : props.src;
    return <NextImage {...props} src={src} />;
}
