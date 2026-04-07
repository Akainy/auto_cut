"use client";
import { useState, useRef } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

// [중요] 빌드 시 서버 사이드에서 미리 렌더링하지 않도록 강제 설정
export const dynamic = "force-dynamic";

export default function Home() {
  const [loaded, setLoaded] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [startTime, setStartTime] = useState("00:00:00");
  const [endTime, setEndTime] = useState("00:00:10");
  const [status, setStatus] = useState("1단계: 엔진을 활성화해주세요.");
  
  // FFmpeg 인스턴스를 처음에는 null로 설정 (서버 로딩 방지)
  const ffmpegRef = useRef<FFmpeg | null>(null);

  const loadFFmpeg = async () => {
    // 버튼을 눌렀을 때(브라우저 환경) 비로소 인스턴스 생성
    if (!ffmpegRef.current) {
      ffmpegRef.current = new FFmpeg();
    }
    
    const ffmpeg = ffmpegRef.current;
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    
    setStatus("엔진 로딩 중... (최초 1회는 시간이 걸립니다)");
    
    try {
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      setLoaded(true);
      setStatus("엔진 준비 완료! 파일을 선택하세요.");
    } catch (err) {
      console.error(err);
      setStatus("로딩 실패. 다시 시도해주세요.");
    }
  };

  const handleTrim = async () => {
    if (!videoFile || !ffmpegRef.current) return alert("파일을 선택해주세요.");
    const ffmpeg = ffmpegRef.current;
    setStatus("영상 처리 중... 잠시만 기다려주세요.");
    
    await ffmpeg.writeFile('input.mp4', await fetchFile(videoFile));
    await ffmpeg.exec(['-i', 'input.mp4', '-ss', startTime, '-to', endTime, '-c', 'copy', 'output.mp4']);
    
    const data = await ffmpeg.readFile('output.mp4');
    const url = URL.createObjectURL(new Blob([(data as any).buffer], { type: 'video/mp4' }));
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `trimmed_${videoFile.name}`;
    a.click();
    setStatus("다운로드 완료!");
  };

  return (
    <div className="p-10 flex flex-col items-center gap-5 font-sans">
      <h1 className="text-3xl font-bold">🎬 AutoCut</h1>
      <div className="border p-8 rounded-xl bg-gray-50 flex flex-col gap-4 w-full max-w-md shadow-md">
        {!loaded ? (
          <button onClick={loadFFmpeg} className="bg-black text-white p-3 rounded-lg hover:bg-gray-800 transition">
            1. 엔진 활성화하기
          </button>
        ) : (
          <>
            <input type="file" accept="video/mp4" onChange={(e) => setVideoFile(e.target.files?.[0] || null)} className="border p-2 bg-white rounded" />
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-gray-500">시작 (HH:MM:SS)</label>
                <input type="text" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full border p-2 rounded" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500">종료 (HH:MM:SS)</label>
                <input type="text" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full border p-2 rounded" />
              </div>
            </div>
            <button onClick={handleTrim} className="bg-blue-600 text-white p-3 rounded-lg font-bold hover:bg-blue-700">
              2. 자르기 및 다운로드
            </button>
          </>
        )}
      </div>
      <p className="text-blue-500 font-medium">상태: {status}</p>
    </div>
  );
}