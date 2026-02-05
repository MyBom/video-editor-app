import React, { useState } from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonButton,
  IonSpinner,
  IonText,
  IonProgressBar,
} from '@ionic/react';
import { VideoEditor } from '@whiteguru/capacitor-plugin-video-editor';
import { FilePicker } from '@capawesome/capacitor-file-picker';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Media } from '@capacitor-community/media';

const CONVERTED_ALBUM_NAME = 'Converted Videos';
const TRIM_END_MS = 7 * 1000;

const Home: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [lastDurationMs, setLastDurationMs] = useState<number | null>(null);

  const handleSelectVideo = async () => {
    try {
      setLoading(true);
      setProgress(0);

      // 1. 갤러리에서 동영상 선택
      setStatus('동영상 선택 중...');
      const pickResult = await FilePicker.pickVideos({ limit: 1, readData: false });
      const pickedFile = pickResult.files?.[0];
      if (!pickedFile) return;

      const fileWithPath = pickedFile as { path?: string; uri?: string };
      const pickedPath = fileWithPath.path ?? fileWithPath.uri;
      if (!pickedPath) throw new Error('선택한 동영상의 경로(uri/path)를 가져오지 못했습니다.');

      // 2. 캐시에 임시 파일로 복사
      const tempFileName = `source_${Date.now()}.mp4`;
      const { uri: tempFileUri } = await Filesystem.getUri({ path: tempFileName, directory: Directory.Cache });
      await FilePicker.copyFile({ from: pickedPath, to: tempFileUri, overwrite: true });

      // 3. 동영상 변환
      setStatus('동영상 변환 중...');
      const listener = await VideoEditor.addListener('transcodeProgress', (info) => {
        if (info.progress) setProgress(info.progress);
      });

      const result = await VideoEditor.edit({
        path: tempFileUri,
        transcode: { height: 480, keepAspectRatio: true, fps: 30 },
        trim: { startsAt: 0, endsAt: TRIM_END_MS },
      });
      listener.remove();

      const durationMs = (result.file as { duration?: number }).duration;
      setLastDurationMs(durationMs ?? null);

      // 4. 캐시 임시 파일 정리
      try {
        await Filesystem.deleteFile({ path: tempFileName, directory: Directory.Cache });
      } catch {
        /* ignore */
      }

      // 5. 변환된 동영상을 앨범에 저장
      setStatus('앨범에 저장 중...');
      let albums = await Media.getAlbums();
      let albumId = albums.albums.find((a) => a.name === CONVERTED_ALBUM_NAME)?.identifier;
      if (!albumId) {
        await Media.createAlbum({ name: CONVERTED_ALBUM_NAME });
        albums = await Media.getAlbums();
        albumId = albums.albums.find((a) => a.name === CONVERTED_ALBUM_NAME)?.identifier;
      }

      await Media.saveVideo({ path: result.file.path, albumIdentifier: albumId! });

      const durationStr = durationMs != null ? `${durationMs} ms (${(durationMs / 1000).toFixed(1)}초)` : '—';
      alert(`동영상 변환 및 저장 완료!\n재생시간: ${durationStr}`);
    } catch (error) {
      console.error('에러:', error);
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      alert(`오류 발생: ${errorMessage}`);
    } finally {
      setLoading(false);
      setProgress(0);
      setStatus('');
    }
  };

  const durationDisplay = lastDurationMs != null
    ? `${lastDurationMs} ms (${(lastDurationMs / 1000).toFixed(1)}초)`
    : null;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Video Editor</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <IonButton expand="block" onClick={handleSelectVideo} disabled={loading}>
          {loading ? <><IonSpinner /> 처리 중...</> : '동영상 선택 및 변환'}
        </IonButton>

        {durationDisplay && (
          <IonText color="medium">
            <p style={{ marginTop: '12px', fontSize: '14px' }}>
              마지막 변환 결과 재생시간: <strong>{durationDisplay}</strong>
            </p>
          </IonText>
        )}

        {loading && (
          <div style={{ marginTop: '20px' }}>
            <IonText><p>{status}</p></IonText>
            {progress > 0 && (
              <>
                <IonProgressBar value={progress / 100} />
                <IonText><p style={{ textAlign: 'center' }}>{Math.round(progress)}%</p></IonText>
              </>
            )}
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};

export default Home;