import Link from "next/link";
import Image from "next/image";

const CustomLink = (props: any) => {
  const href = props.href;
  const isInternalLink: boolean =
    href && (href.startsWith("/") || href.startsWith("#"));

  if (isInternalLink) {
    return (
      <Link href={href} {...props}>
        {props.children}
      </Link>
    );
  }

  return <a target="_blank" rel="noopener noreferrer" {...props} />;
};

function RoundedImage(props: any) {
  return (
    <Image
      alt={props.alt}
      className="rounded-lg"
      {...props}
      style={{
        maxWidth: "100%",
        height: "auto",
      }}
    />
  );
}

const MDXComponents = {
  Image: RoundedImage,
  a: CustomLink,
};

export default MDXComponents;
