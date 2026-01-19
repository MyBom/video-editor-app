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

const Home: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');

  const handleSelectVideo = async () => {
    try {
      setLoading(true);
      setProgress(0);

      // 1. 갤러리에서 동영상 선택
      setStatus('동영상 선택 중...');
      const pickResult = await FilePicker.pickVideos({ limit: 1, readData: false });
      const pickedFile = pickResult.files?.[0];
      if (!pickedFile) return;

      // 플랫폼별로 제공되는 동영상 경로(path/uri) 중 사용 가능한 값 선택
      const pickedPath = (pickedFile as any).path ?? (pickedFile as any).uri;
      if (!pickedPath) throw new Error('선택한 동영상의 경로(uri/path)를 가져오지 못했습니다.');

      // 캐시에 임시 파일 생성
      const tempFileName = `source_${Date.now()}.mp4`;
      const tempFileUriResult = await Filesystem.getUri({ path: tempFileName, directory: Directory.Cache });
      const tempFileUri = tempFileUriResult.uri;

      await FilePicker.copyFile({ from: pickedPath, to: tempFileUri, overwrite: true });

      // 2. 동영상 변환
      setStatus('동영상 변환 중...');
      const listener = await VideoEditor.addListener('transcodeProgress', (info) => {
        if (info.progress) setProgress(info.progress);
      });

      const result = await VideoEditor.edit({
        path: tempFileUri,
        transcode: { height: 480, keepAspectRatio: true, fps: 30 },
        trim: { startsAt: 0, endsAt: 5 * 1000 }, // 0~5초 자르기
      });

      listener.remove();

      // 변환 시작 후에는 캐시 임시 파일 정리
      try {
        await Filesystem.deleteFile({ path: tempFileName, directory: Directory.Cache });
      } catch {
        // ignore
      }

      // 3. 변환된 동영상을 앨범에 저장
      setStatus('앨범에 저장 중...');
      // 'Converted Videos' 앨범 찾기 또는 생성
      const albums = await Media.getAlbums();
      let albumId = albums.albums.find((a) => a.name === 'Converted Videos')?.identifier;

      if (!albumId) {
        await Media.createAlbum({ name: 'Converted Videos' });
        const updated = await Media.getAlbums();
        albumId = updated.albums.find((a) => a.name === 'Converted Videos')?.identifier;
      }

      await Media.saveVideo({ path: result.file.path, albumIdentifier: albumId! });

      alert('동영상 변환 및 저장 완료!');
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