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
    // 전체 컨테이너 패딩 유지
    <div className="p-10 flex flex-col items-center gap-5 font-sans min-h-screen bg-gray-50/50">
      
      {/* --- 업그레이드된 로고 섹션 (H1 부분 변경) --- */}
      <div className="flex flex-col items-center justify-center space-y-2 mb-8">
        <div className="flex items-center space-x-3">
          {/* 가위(비디오 컷) 아이콘 로고 + 블루 그라데이션 배경 */}
          <div className="bg-gradient-to-tr from-blue-700 to-blue-400 p-2.5 rounded-2xl shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19.14 7.5c.32.33.32.85 0 1.18l-3.32 3.32c1.3.16 2.3 1.25 2.3 2.6V17a3 3 0 01-3 3h-2.1c-.88 0-1.7-.37-2.31-1.02L6 13.04a2.98 2.98 0 01-1-2.2c0-1.65 1.34-3 3-3h.6l4.24 4.24-1.18 1.18c-.2.2-.2.5 0 .7l.5.5c.2.2.5.2.7 0l2.31-2.32c.33-.32.85-.32 1.18 0l3.31 3.32c.2.2.5.2.7 0l1.18-1.18a.5.5 0 01.7 0c.32.32.32.85 0 1.17l-3.31 3.32a.49.49 0 000 .7c.2.2.5.2.7 0l4.31-4.3c1.17-1.17 1.17-3.07 0-4.24L19.14 7.5z" />
            </svg>
          </div>
          {/* 볼드한 타이포그래피 + 그라데이션 텍스트 */}
          <h1 className="text-5xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-gray-950 via-gray-700 to-gray-950">
            AutoCut
          </h1>
        </div>
        {/* 슬로건 추가 */}
        <p className="text-gray-400 font-medium text-sm tracking-widest uppercase">Smart Video Trimming Tool</p>
      </div>

      {/* --- 제어 박스 및 나머지 코드 (기존과 완전히 동일) --- */}
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