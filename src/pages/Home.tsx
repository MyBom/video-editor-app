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
    let tempFileName = '';

    try {
      setLoading(true);
      setProgress(0);

      // 1. 갤러리에서 동영상 선택
      setStatus('동영상 선택 중...');
      const pickResult = await FilePicker.pickVideos({ limit: 1, readData: true });
      if (!pickResult.files?.[0]?.data) return;

      // 2. 선택한 동영상을 임시 파일로 저장
      setStatus('임시 파일 생성 중...');
      tempFileName = `source_${Date.now()}.mp4`;
      const tempFile = await Filesystem.writeFile({
        path: tempFileName,
        data: pickResult.files[0].data,
        directory: Directory.Cache,
      });

      // 3. 동영상 변환
      setStatus('동영상 변환 중...');
      const listener = await VideoEditor.addListener('transcodeProgress', (info) => {
        if (info.progress) setProgress(info.progress);
      });

      const result = await VideoEditor.edit({
        path: tempFile.uri,
        transcode: { width: 720, height: 480, keepAspectRatio: true, fps: 30 },
        trim: { startsAt: 0, endsAt: 5 * 1000 }, // 0~5초 자르기
      });

      listener.remove();

      // 4. 임시 파일 삭제
      setStatus('임시 파일 삭제 중...');
      await Filesystem.deleteFile({ path: tempFileName, directory: Directory.Cache });

      // 5. 변환된 동영상을 앨범에 저장
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