export function PdfAttachment({ uri, onError }: { uri: string; onError: () => void }) {
  return (
    <iframe
      title="PDF attachment"
      src={uri}
      onError={onError}
      style={{ flex: 1, width: '100%', height: '100%', border: 0 }}
    />
  );
}
