interface Props {
  title: string;
}

export default function SectionHeader({ title }: Props) {
  return (
    <div
      style={{
        fontSize: 18,
        fontWeight: 600,
        marginBottom: 12,
      }}
    >
      {title}
    </div>
  );
}