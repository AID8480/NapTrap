interface BlobConfig {
  color: string;
  size: string;
  top: string;
  left: string;
  delay: string;
}

interface Props {
  blobs: BlobConfig[];
}

export function AmbientBlobs({ blobs }: Props) {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none" aria-hidden>
      {blobs.map((b, i) => (
        <div
          key={i}
          className={`absolute rounded-full blur-3xl opacity-25 animate-blob ${b.color} ${b.size}`}
          style={{ top: b.top, left: b.left, animationDelay: b.delay }}
        />
      ))}
    </div>
  );
}
