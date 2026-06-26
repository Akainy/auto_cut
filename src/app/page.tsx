"use client";
import { useState, useRef, useEffect } from 'react';
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
  
  // --- [신규 추가] 진행률 및 알림 창 상태 관리 ---
  const [progress, setProgress] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [showToast, setShowToast] = useState<boolean>(false);
  
  // FFmpeg 인스턴스를 처음에는 null로 설정 (서버 로딩 방지)
  const ffmpegRef = useRef<FFmpeg | null>(null);

  // --- HH:MM:SS 형식을 초(seconds)로 변환하는 함수 ---
  const timeToSeconds = (timeStr: string): number => {
    const parts = timeStr.split(':').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return 0;
    const [h, m, s] = parts;
    return h * 3600 + m * 60 + s;
  };

  // --- 초(seconds)를 HH:MM:SS 형식으로 변환하는 함수 ---
  const secondsToTime = (secs: number): string => {
    const totalSeconds = Math.max(0, secs); // 음수 방지
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    
    const pad = (num: number) => String(num).padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  };

  // --- 시간을 증감시키는 전용 핸들러 ---
  const adjustTime = (type: 'start' | 'end', amount: number) => {
    if (type === 'start') {
      const currentSecs = timeToSeconds(startTime);
      setStartTime(secondsToTime(currentSecs + amount));
    } else {
      const currentSecs = timeToSeconds(endTime);
      setEndTime(secondsToTime(currentSecs + amount));
    }
  };

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
    
    // 로딩 시작 및 프로그래스 리셋
    setIsProcessing(true);
    setProgress(0);
    setStatus("재인코딩 없이 고속 컷팅 중...");
    
    // --- [신규 추가] FFmpeg 내부 진행률 파싱 이벤트 리스너 ---
    const totalDuration = timeToSeconds(endTime) - timeToSeconds(startTime);
    ffmpeg.on('log', ({ message }) => {
      // 로그 메시지 중 'time=00:00:02.50' 형태의 문자열을 추적하여 진행률 계산
      const timeMatch = message.match(/time=(\d+):(\d+):(\d+)\.(\d+)/);
      if (timeMatch && totalDuration > 0) {
        const hours = parseInt(timeMatch[1], 10);
        const minutes = parseInt(timeMatch[2], 10);
        const seconds = parseInt(timeMatch[3], 10);
        const currentSeconds = hours * 3600 + minutes * 60 + seconds;
        
        // 퍼센트 계산 (최대 100%)
        const pct = Math.min(Math.round((currentSeconds / totalDuration) * 100), 100);
        setProgress(pct);
      }
    });

    try {
      await ffmpeg.writeFile('input.mp4', await fetchFile(videoFile));

      await ffmpeg.exec([
        '-ss', startTime, 
        '-to', endTime, 
        '-i', 'input.mp4', 
        '-c', 'copy', 
        'output.mp4'
      ]);
      
      // 작업 완료 시 강제로 100% 채우기
      setProgress(100);

      const data = await ffmpeg.readFile('output.mp4');
      const url = URL.createObjectURL(new Blob([(data as any).buffer], { type: 'video/mp4' }));
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `trimmed_${videoFile.name}`;
      a.click();
      
      setStatus("다운로드 완료!");
      
      // --- [신규 추가] 성공 안내창(Toast) 5초 띄우기 ---
      setShowToast(true);
      setTimeout(() => {
        setShowToast(false);
      }, 5000);

    } catch (error) {
      console.error(error);
      setStatus("처리 중 오류가 발생했습니다.");
    } finally {
      // 로딩 끝
      setIsProcessing(false);
    }
  };

  return (
    // 전체 컨테이너 패딩 유지
    <div className="p-10 flex flex-col items-center gap-5 font-sans min-h-screen bg-gray-50/50 relative">
      
      {/* --- [신규 추가] 상단 우측 5초 노출 알림 팝업 (Toast) --- */}
      {showToast && (
        <div className="fixed top-5 right-5 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-2xl font-medium animate-bounce flex items-center gap-2 z-50 transition-all">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          성공적으로 비디오 컷팅 및 다운로드가 완료되었습니다!
        </div>
      )}

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

      {/* --- 제어 박스 및 나머지 코드 --- */}
      <div className="border p-8 rounded-xl bg-gray-50 flex flex-col gap-4 w-full max-w-md shadow-md relative overflow-hidden">
        
        {/* --- [신규 추가] 작업 중일 때 박스를 덮는 블러 오버레이 락(Lock) 및 스피너 --- */}
        {isProcessing && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center gap-3 animate-fade-in">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-bold text-gray-700">영상을 처리하는 중입니다...</p>
            <p className="text-xs text-blue-600 font-mono font-semibold bg-blue-50 px-2.5 py-1 rounded-full">{progress}% 완료</p>
          </div>
        )}

        {!loaded ? (
          <button onClick={loadFFmpeg} className="bg-black text-white p-3 rounded-lg hover:bg-gray-800 transition">
            1. 엔진 활성화하기
          </button>
        ) : (
          <>
            <input type="file" accept="video/mp4" onChange={(e) => setVideoFile(e.target.files?.[0] || null)} className="border p-2 bg-white rounded" />
            
            <div className="flex gap-4">
              {/* --- 시작 시간 컨트롤러 블록 --- */}
              <div className="flex-1">
                <label className="text-xs text-gray-500 font-semibold block mb-1">시작 (HH:MM:SS)</label>
                <input type="text" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full border p-2 rounded text-center font-mono shadow-sm focus:outline-none focus:border-blue-500" />
                
                {/* 조절 버튼 묶음 */}
                <div className="grid grid-cols-3 gap-1 mt-1.5 text-[11px] font-medium text-gray-600">
                  <button onClick={() => adjustTime('start', 60)} className="bg-white border rounded py-1 hover:bg-gray-100 transition shadow-sm">+1분</button>
                  <button onClick={() => adjustTime('start', 10)} className="bg-white border rounded py-1 hover:bg-gray-100 transition shadow-sm">+10초</button>
                  <button onClick={() => adjustTime('start', 1)} className="bg-white border rounded py-1 hover:bg-gray-100 transition shadow-sm">+1초</button>
                  
                  <button onClick={() => adjustTime('start', -60)} className="bg-white border rounded py-1 hover:bg-gray-100 transition shadow-sm text-red-500">-1분</button>
                  <button onClick={() => adjustTime('start', -10)} className="bg-white border rounded py-1 hover:bg-gray-100 transition shadow-sm text-red-500">-10초</button>
                  <button onClick={() => adjustTime('start', -1)} className="bg-white border rounded py-1 hover:bg-gray-100 transition shadow-sm text-red-500">-1초</button>
                </div>
              </div>
              
              {/* --- 종료 시간 컨트롤러 블록 --- */}
              <div className="flex-1">
                <label className="text-xs text-gray-500 font-semibold block mb-1">종료 (HH:MM:SS)</label>
                <input type="text" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full border p-2 rounded text-center font-mono shadow-sm focus:outline-none focus:border-blue-500" />
                
                {/* 조절 버튼 묶음 */}
                <div className="grid grid-cols-3 gap-1 mt-1.5 text-[11px] font-medium text-gray-600">
                  <button onClick={() => adjustTime('end', 60)} className="bg-white border rounded py-1 hover:bg-gray-100 transition shadow-sm">+1분</button>
                  <button onClick={() => adjustTime('end', 10)} className="bg-white border rounded py-1 hover:bg-gray-100 transition shadow-sm">+10초</button>
                  <button onClick={() => adjustTime('end', 1)} className="bg-white border rounded py-1 hover:bg-gray-100 transition shadow-sm">+1초</button>
                  
                  <button onClick={() => adjustTime('end', -60)} className="bg-white border rounded py-1 hover:bg-gray-100 transition shadow-sm text-red-500">-1분</button>
                  <button onClick={() => adjustTime('end', -10)} className="bg-white border rounded py-1 hover:bg-gray-100 transition shadow-sm text-red-500">-10초</button>
                  <button onClick={() => adjustTime('end', -1)} className="bg-white border rounded py-1 hover:bg-gray-100 transition shadow-sm text-red-500">-1초</button>
                </div>
              </div>
            </div>

            <button onClick={handleTrim} className="bg-blue-600 text-white p-3 rounded-lg font-bold hover:bg-blue-700 transition mt-2">
              2. 자르기 및 다운로드
            </button>
          </>
        )}
      </div>

      {/* --- [신규 추가] 박스 외부 하단 실시간 진행률 프로그래스 바 --- */}
      {isProcessing && (
        <div className="w-full max-w-md bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 overflow-hidden shadow-inner mt-1">
          <div 
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out" 
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      )}

      <p className="text-blue-500 font-medium">상태: {status}</p>
    </div>
  );
}