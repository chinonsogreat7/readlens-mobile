import { useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import Pdf from 'react-native-pdf';

export function PdfAttachment({ uri, onError }: { uri: string; onError: () => void }) {
  const source = useMemo(() => ({ uri, cache: false }), [uri]);
  const [position, setPosition] = useState({ page: 1, total: 0 });
  return (
    <View style={{ flex: 1 }}>
      <Pdf
        source={source}
        trustAllCerts={false}
        minScale={1}
        maxScale={4}
        fitPolicy={0}
        enableDoubleTapZoom
        enableAnnotationRendering={false}
        onPressLink={() => {
          /* Attachments do not navigate to outside destinations. */
        }}
        onLoadComplete={(total) => setPosition({ page: 1, total })}
        onPageChanged={(page, total) => setPosition({ page, total })}
        onError={onError}
        renderActivityIndicator={() => (
          <ActivityIndicator accessibilityLabel="Loading PDF" color="white" />
        )}
        style={{ flex: 1, backgroundColor: '#111A16' }}
      />
      {position.total > 0 && (
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: '#BFCBC4', textAlign: 'center', padding: 16 }}
        >
          Page {position.page} of {position.total}
        </Text>
      )}
    </View>
  );
}
