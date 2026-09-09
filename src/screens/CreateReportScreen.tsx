import { useEffect, useRef, useState } from 'react';
import { usePreventRemove } from '@react-navigation/native';
import {
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParams } from '../navigation';
import { reportsRepository } from '../services';
import { demoMode } from '../config';
import { CreationUncertainError } from '../api/reports';
import { photoAttachment } from '../domain/photo-attachment';
import {
  attachmentType,
  validateDraft,
  type Attachment,
  type ReportDraft,
} from '../domain/reports';
import { Button, Card, Field, Icon, IconButton, Notice, textStyles as t } from '../ui/components';
import { Screen } from '../ui/Screen';
import { AttachmentSourceChooser } from '../ui/AttachmentSourceChooser';
import { colors as c } from '../ui/theme';

export function CreateReportScreen({
  navigation,
}: NativeStackScreenProps<RootStackParams, 'CreateReport'>) {
  const [title, setTitle] = useState('');
  const insets = useSafeAreaInsets();
  const [description, setDescription] = useState('');
  const [attachment, setAttachment] = useState<Attachment>();
  const [attempted, setAttempted] = useState(false);
  const [touched, setTouched] = useState({ title: false, description: false });
  const [keyboardVisible, setKeyboardVisible] = useState(() => Keyboard.isVisible());
  const [fileError, setFileError] = useState<string>();
  const [picking, setPicking] = useState(false);
  const [choosingSource, setChoosingSource] = useState(false);
  const pickerPending = useRef(false);
  const descriptionInput = useRef<TextInput>(null);
  const formScroll = useRef<ScrollView>(null);
  const formOffset = useRef(0);
  const descriptionOffset = useRef(0);
  function revealDescription() {
    formScroll.current?.scrollTo({
      y: Math.max(0, formOffset.current + descriptionOffset.current - 12),
      animated: false,
    });
  }
  useEffect(() => {
    // Reveal once after the keyboard opens, never on every viewport layout:
    // repeated scrollTo calls fight user scrolling and keyboard resizing.
    const opening = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true),
    );
    const shown = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
      if (descriptionInput.current?.isFocused()) revealDescription();
    });
    // Wait until dismissal finishes so the action never rides above the keyboard.
    const hidden = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      opening.remove();
      shown.remove();
      hidden.remove();
    };
  }, []);
  const client = useQueryClient();
  const pending = useRef<AbortController | null>(null);
  const [createdId, setCreatedId] = useState<string>();
  useEffect(() => () => pending.current?.abort(), []);
  const create = useMutation({
    mutationFn: (draft: ReportDraft) => reportsRepository.create(draft, pending.current?.signal),
    onSuccess: (report) => {
      void client.invalidateQueries({ queryKey: ['reports'] });
      setCreatedId(report.id);
    },
    onSettled: () => {
      pending.current = null;
    },
  });
  usePreventRemove(create.isPending && !createdId, () => {
    /* Keep the submission visible until its result is known. */
  });
  useEffect(() => {
    if (createdId) navigation.replace('ReportDetail', { id: createdId, justCreated: true });
  }, [createdId, navigation]);
  const uncertain = create.error instanceof CreationUncertainError;
  const validation = validateDraft({ title, description });
  const incomplete = Boolean(validation.title || validation.description);
  const errors = {
    title: attempted || touched.title ? validation.title : undefined,
    description: attempted || touched.description ? validation.description : undefined,
  };
  async function pickFile(source: 'photos' | 'files') {
    if (pickerPending.current || pending.current || create.isPending) return;
    pickerPending.current = true;
    setPicking(true);
    setFileError(undefined);
    try {
      if (source === 'photos') {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsMultipleSelection: false,
          allowsEditing: false,
          quality: 1,
          preferredAssetRepresentationMode:
            ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
        });
        if (result.canceled) return;
        const photo = result.assets[0];
        if (!photo) return;
        try {
          setAttachment(photoAttachment(photo));
        } catch {
          setFileError('Choose a JPEG, PNG or WEBP photo, or use Files for a PDF.');
        }
        return;
      }
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      if (!file) return;
      const type = attachmentType(file.mimeType, file.name);
      if (!type) {
        setFileError('Choose a JPEG, PNG, WEBP image or PDF document.');
        return;
      }
      setAttachment({ name: file.name, uri: file.uri, type, size: file.size });
    } catch {
      setFileError(
        source === 'photos'
          ? 'The photo library couldn’t be opened. Please try again or use Files.'
          : 'The file picker couldn’t be opened. Please try again.',
      );
    } finally {
      pickerPending.current = false;
      setPicking(false);
    }
  }
  function submit() {
    if (pending.current || uncertain || pickerPending.current) return;
    setAttempted(true);
    const draft = { title, description, attachment };
    const validation = validateDraft(draft);
    if (!validation.title && !validation.description && !create.isPending) {
      Keyboard.dismiss();
      pending.current = new AbortController();
      create.mutate(draft);
    }
  }
  return (
    <Screen scroll={false} backgroundColor={c.background} keyboardVerticalOffset={insets.top}>
      <View style={styles.header}>
        <IconButton name="arrow-back" label="Go back" onPress={() => navigation.goBack()} />
        <Text accessibilityRole="header" style={styles.headerTitle}>
          New report
        </Text>
      </View>
      <ScrollView
        ref={formScroll}
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.intro}>
          <Text accessibilityRole="header" style={styles.heading}>
            Share an update
          </Text>
          <Text style={styles.subtitle}>A clear title and a few details are all you need.</Text>
        </View>
        <View
          style={{ gap: 22 }}
          onLayout={(event) => {
            formOffset.current = event.nativeEvent.layout.y;
          }}
        >
          <Field
            label="Report title"
            placeholder="Give your report a short title"
            value={title}
            onChangeText={setTitle}
            onBlur={() => setTouched((current) => ({ ...current, title: true }))}
            error={errors.title}
            editable={!create.isPending}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => descriptionInput.current?.focus()}
          />
          <View
            onLayout={(event) => {
              descriptionOffset.current = event.nativeEvent.layout.y;
            }}
          >
            <Field
              label="Description"
              placeholder="What happened? Add the details that matter."
              multiline
              // The expanding field shares the page's scroll container instead
              // of trapping swipes in a second, unbounded native text scroller.
              scrollEnabled={false}
              inputRef={descriptionInput}
              onFocus={revealDescription}
              value={description}
              onChangeText={setDescription}
              onBlur={() => setTouched((current) => ({ ...current, description: true }))}
              error={errors.description}
              editable={!create.isPending}
              style={{ minHeight: 144, lineHeight: 23 }}
            />
          </View>
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={t.label}>Supporting file</Text>
              <Text style={{ color: c.muted, fontSize: 12 }}>Optional</Text>
            </View>
            {attachment ? (
              <Card style={{ padding: 16 }}>
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  <Icon name="document-attach-outline" size={26} />
                  <View style={{ flex: 1, gap: 5 }}>
                    <Text numberOfLines={2} style={t.label}>
                      {attachment.name}
                    </Text>
                    <Text style={{ color: c.muted, fontSize: 11 }}>
                      {attachment.type}
                      {attachment.size !== undefined
                        ? ` · ${Math.ceil(attachment.size / 1024)} KB`
                        : ''}
                    </Text>
                  </View>
                  <IconButton
                    name="close"
                    label="Remove attachment"
                    onPress={() => {
                      if (!create.isPending) setAttachment(undefined);
                    }}
                  />
                </View>
              </Card>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Choose a supporting file"
                accessibilityState={{ disabled: picking || create.isPending }}
                disabled={picking || create.isPending}
                onPress={() => {
                  if (pickerPending.current || pending.current) return;
                  Keyboard.dismiss();
                  setChoosingSource(true);
                }}
                style={({ pressed }) => [
                  styles.dropzone,
                  pressed && { backgroundColor: c.softGreen },
                ]}
              >
                <View style={styles.uploadIcon}>
                  <Icon name="cloud-upload-outline" size={26} />
                </View>
                <View style={{ flex: 1, gap: 5 }}>
                  <Text style={[t.label, { color: c.green }]}>Choose a file</Text>
                  <Text style={styles.fileHint}>JPEG, PNG, WEBP or PDF</Text>
                </View>
                <Icon name="add" size={22} />
              </Pressable>
            )}
            {fileError && <Notice error>{fileError}</Notice>}
            {attachment && (
              <Text style={styles.fileHint}>This file will upload when you submit.</Text>
            )}
          </View>
          {create.isError && <Notice error>{create.error.message}</Notice>}
        </View>
      </ScrollView>
      {!keyboardVisible && (
        <View style={styles.footer}>
          {!uncertain && (
            <Button
              label={
                create.isPending
                  ? 'Submitting report…'
                  : demoMode
                    ? 'Create sample report'
                    : 'Submit report'
              }
              icon="arrow-forward"
              loading={create.isPending}
              disabled={picking || choosingSource || incomplete}
              onPress={submit}
            />
          )}
          {uncertain && (
            <Button
              label="Check report list before resubmitting"
              secondary
              onPress={() => {
                void client.invalidateQueries({ queryKey: ['reports'] });
                navigation.popToTop();
              }}
            />
          )}
        </View>
      )}
      <AttachmentSourceChooser
        visible={choosingSource}
        onClose={() => setChoosingSource(false)}
        onSelect={(source) => void pickFile(source)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 17, fontWeight: '600', color: c.ink },
  content: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 },
  intro: { gap: 8, marginBottom: 26 },
  heading: { fontSize: 28, lineHeight: 36, fontWeight: '700', letterSpacing: -0.8, color: c.ink },
  subtitle: { fontSize: 14, lineHeight: 22, color: c.muted },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: c.line,
    backgroundColor: c.background,
  },
  fileHint: { fontSize: 12, lineHeight: 18, color: c.muted },
  dropzone: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#A7B9A6',
    borderRadius: 18,
    backgroundColor: '#F0F4EB',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  uploadIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#E3EBDD',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
