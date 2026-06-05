import { ImgHTMLAttributes } from "react";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

type ImageProps = ImgHTMLAttributes<HTMLImageElement> & {
    src: string;
    alt: string;
    width?: number;
    height?: number;
};

export default function Image(props: ImageProps) {
    let src = props.src;
    if (
        typeof src === "string" &&
        !src.startsWith(basePath) &&
        src.startsWith("/")
    ) {
        src = `${basePath}${src}`;
    }
    // next/image is avoided here because the app uses static export and a shared basePath wrapper.
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} alt={props.alt} src={src} />;
}
