import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, Layers, LayoutGrid, User, MessageSquare, 
  Plus, Trash2, Search, Activity, Cpu, ArrowRight, 
  HardDrive, Info, AlertCircle, CheckCircle2, TrendingDown, Zap
} from 'lucide-react';

// --- 설정 ---
const TOTAL_SLOTS = 64;       
const BLOCK_SIZE = 2;         
const MAX_SEQ_LEN = 8;        

const COLORS = [
  '#6366f1', '#f43f5e', '#10b981', '#f59e0b', 
  '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16',
  '#0ea5e9', '#f97316', '#14b8a6', '#d946ef'
];

const RAW_DATA = [
  { id: 'TK-1001', intent: 'Account_Unlock', text: "로그인이 안 됩니다. 계정이 잠긴 것 같아요.", len: 5 },
  { id: 'TK-1002', intent: 'Refund_Request', text: "구독 취소했는데 결제가 되었습니다.", len: 6 },
  { id: 'TK-1003', intent: 'Bug_Report', text: "API 호출 시 간헐적으로 500 에러가 발생합니다.", len: 4 },
  { id: 'TK-1004', intent: 'Feature_Request', text: "다크 모드 기능은 언제 추가되나요?", len: 3 },
  { id: 'TK-1005', intent: 'Payment_Change', text: "결제 카드를 법인 카드로 변경하고 싶습니다.", len: 5 },
  { id: 'TK-1006', intent: 'General_Inquiry', text: "이 서비스 무료 체험 기간이 며칠인가요?", len: 4 },
  { id: 'TK-1007', intent: 'Bug_Report', text: "대시보드 데이터 갱신 안됨.", len: 3 },
  { id: 'TK-1008', intent: 'Account_Closure', text: "탈퇴 버튼이 안 보입니다.", len: 2 },
  { id: 'TK-1009', intent: 'Feature_Request', text: "PDF 내보내기 기능 필요.", len: 4 },
  { id: 'TK-1010', intent: 'Invoicing', text: "영수증 이메일 발송 요청.", len: 3 },
];

const FULL_DATASET = Array.from({ length: 50 }).map((_, i) => {
    const template = RAW_DATA[i % RAW_DATA.length];
    return { 
        ...template, 
        id: `TK-${1000+i+1}`, 
        hexColor: COLORS[i % COLORS.length] 
    };
});

const App = () => {
  const [mode, setMode] = useState('paged'); 
  const [memory, setMemory] = useState(Array(TOTAL_SLOTS).fill(null));
  const [requests, setRequests] = useState([]);
  const [nextReqIndex, setNextReqIndex] = useState(0); 
  const [logs, setLogs] = useState([]); 
  const [hoveredReqId, setHoveredReqId] = useState(null);
  const [lastAddedReq, setLastAddedReq] = useState(null);

  const displayReq = requests.find(r => r.id === hoveredReqId) || lastAddedReq;
  
  // --- 메모리 통계 계산 ---
  const totalAllocatedSlots = memory.filter(s => s !== null).length;
  const memoryUsage = Math.round((totalAllocatedSlots / TOTAL_SLOTS) * 100);
  
  // 실제 데이터가 차지하는 슬롯 수 ( len )
  const actualDataSlots = requests.reduce((acc, req) => acc + req.len, 0);
  // 낭비되는 슬롯 수 ( 할당된 전체 슬롯 - 실제 데이터 슬롯 )
  const wasteSlots = totalAllocatedSlots - actualDataSlots;
  const wasteRate = totalAllocatedSlots > 0 ? Math.round((wasteSlots / totalAllocatedSlots) * 100) : 0;
  const efficiencyScore = totalAllocatedSlots > 0 ? 100 - wasteRate : 100;

  const addLog = (msg, type = 'info') => {
    setLogs(prev => [{ msg, type, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 5));
  };

  const reset = () => {
    setMemory(Array(TOTAL_SLOTS).fill(null));
    setRequests([]);
    setNextReqIndex(0);
    setLogs([]);
    setHoveredReqId(null);
    setLastAddedReq(null);
    addLog("시스템이 초기화되었습니다.", "warn");
  };

  useEffect(() => { reset(); }, [mode]);

  const allocateRequest = (template) => {
    const newReqId = template.id; 
    const requiredLen = template.len || 4;
    let newMemory = [...memory];
    let allocatedIndices = [];

    if (mode === 'standard') {
      let startIdx = -1;
      for (let i = 0; i <= TOTAL_SLOTS - MAX_SEQ_LEN; i++) {
        if (newMemory.slice(i, i + MAX_SEQ_LEN).every(s => s === null)) {
          startIdx = i;
          break;
        }
      }
      if (startIdx !== -1) {
         for(let i=0; i<MAX_SEQ_LEN; i++) {
             const type = i < requiredLen ? 'data' : 'waste';
             newMemory[startIdx+i] = { ...template, reqId: newReqId, type }; 
             allocatedIndices.push(startIdx+i);
         }
         return { success: true, newMemory, allocatedIndices };
      }
      return { success: false };
    } else {
      const blocksNeeded = Math.ceil(requiredLen / BLOCK_SIZE);
      let freeBlockIndices = [];
      for(let i=0; i<TOTAL_SLOTS; i+=BLOCK_SIZE) {
         if (newMemory[i] === null) freeBlockIndices.push(i);
      }
      if (freeBlockIndices.length >= blocksNeeded) {
         let selectedIndices = [];
         for(let k=0; k<blocksNeeded; k++) {
            const randIdx = Math.floor(Math.random() * freeBlockIndices.length);
            selectedIndices.push(freeBlockIndices[randIdx]);
            freeBlockIndices.splice(randIdx, 1); 
         }
         let tokensLeft = requiredLen;
         for (let startIdx of selectedIndices) {
             for(let j=0; j<BLOCK_SIZE; j++) {
                 const type = tokensLeft > 0 ? 'data' : 'reserved';
                 newMemory[startIdx+j] = { ...template, reqId: newReqId, type };
                 allocatedIndices.push(startIdx+j);
                 if(tokensLeft > 0) tokensLeft--;
             }
         }
         return { success: true, newMemory, allocatedIndices };
      }
      return { success: false };
    }
  };

  const manualAdd = () => {
    const data = FULL_DATASET[nextReqIndex % FULL_DATASET.length];
    const result = allocateRequest(data);
    if (result.success) {
      setMemory(result.newMemory);
      const newReq = { ...data, allocatedIndices: result.allocatedIndices, status: 'active' };
      setRequests(prev => [...prev, newReq]);
      setLastAddedReq(newReq);
      setNextReqIndex(prev => prev + 1);
      addLog(`${data.id} 할당 성공`, "success");
    } else {
      addLog(`공간 부족: ${data.id} 할당 실패`, "error");
    }
  };

  const manualRemove = () => {
    if (requests.length === 0) return;
    const randomIndex = Math.floor(Math.random() * requests.length);
    const targetReq = requests[randomIndex];
    let newMemory = [...memory];
    targetReq.allocatedIndices.forEach(idx => newMemory[idx] = null);
    setMemory(newMemory);
    setRequests(prev => prev.filter(r => r.id !== targetReq.id));
    if (hoveredReqId === targetReq.id) setHoveredReqId(null);
    if (lastAddedReq && lastAddedReq.id === targetReq.id) setLastAddedReq(null);
    addLog(`${targetReq.id} 세션 종료 및 메모리 해제`, "info");
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#0f172a] text-slate-200 font-sans p-6 overflow-hidden box-border">
      
      {/* --- Dynamic Header --- */}
      <header className="flex-none mb-6 grid grid-cols-12 gap-4 h-28">
        <div className="col-span-8 bg-slate-800/50 backdrop-blur-md border border-slate-700 rounded-2xl p-4 flex items-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
          {displayReq ? (
             <div className="flex gap-6 w-full items-center">
                <div className="flex-none w-16 h-16 rounded-xl flex items-center justify-center text-white font-bold shadow-lg overflow-hidden relative" style={{ backgroundColor: displayReq.hexColor }}>
                  <User className="w-8 h-8 opacity-20 absolute" />
                  <span className="relative z-10 text-xl font-black">{displayReq.id.slice(-4)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-xl font-bold text-white tracking-tight leading-none">{displayReq.id}</h2>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 border border-slate-600 uppercase tracking-widest leading-none">{displayReq.intent}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 leading-none">
                      {mode === 'standard' ? 'Static (8 Slots)' : `Dynamic (${Math.ceil(displayReq.len/2)} Pages)`}
                    </span>
                  </div>
                  <div className="flex items-start gap-2 text-slate-400 bg-black/20 p-2 rounded-lg border border-white/5 mt-1">
                    <MessageSquare className="w-4 h-4 mt-0.5 text-indigo-400 shrink-0" />
                    <p className="text-sm italic truncate">"{displayReq.text}"</p>
                  </div>
                </div>
             </div>
          ) : (
             <div className="flex items-center gap-4 text-slate-500">
                <div className="w-12 h-12 rounded-full border-2 border-dashed border-slate-700 flex items-center justify-center">
                  <Cpu className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-400 uppercase tracking-widest">SYSTEM STANDBY</h2>
                  <p className="text-xs text-slate-500">데이터 할당을 시작하려면 우측 'Add Ticket' 버튼을 누르세요.</p>
                </div>
             </div>
          )}
        </div>

        <div className="col-span-4 bg-slate-800/50 backdrop-blur-md border border-slate-700 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <div className="flex bg-slate-900/80 p-1 rounded-xl border border-slate-700">
              <button onClick={() => setMode('standard')} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${mode==='standard'?'bg-rose-500 text-white shadow-lg shadow-rose-500/20':'text-slate-500 hover:text-slate-300'}`}>
                <Layers className="w-3.5 h-3.5"/> Standard
              </button>
              <button onClick={() => setMode('paged')} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${mode==='paged'?'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20':'text-slate-500 hover:text-slate-300'}`}>
                <LayoutGrid className="w-3.5 h-3.5"/> Paged
              </button>
            </div>
            <button onClick={reset} className="p-2 text-slate-500 hover:text-white transition-all hover:rotate-180 duration-500">
              <RefreshCw className="w-5 h-5"/>
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={manualAdd} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-xl font-bold text-sm shadow-lg shadow-indigo-600/20 transition-all active:scale-95 flex items-center justify-center gap-2">
              <Plus className="w-4 h-4"/> Add Ticket
            </button>
            <button onClick={manualRemove} className="px-4 py-2 border border-slate-600 text-slate-400 hover:bg-slate-700 hover:text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center">
              <Trash2 className="w-4 h-4"/>
            </button>
          </div>
        </div>
      </header>

      <div className="flex gap-6 flex-1 min-h-0">
        {/* --- Sidebar --- */}
        <aside className="w-80 flex flex-col gap-4 flex-none overflow-hidden">
          {/* Usage Stats Card */}
          <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">Memory Capacity</h3>
              <div className={`px-2 py-0.5 rounded text-[10px] font-bold ${memoryUsage > 80 ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                {memoryUsage}% Occupied
              </div>
            </div>
            <div className="relative h-2.5 bg-slate-900 rounded-full overflow-hidden border border-white/5">
              <div className={`h-full transition-all duration-1000 ease-out ${memoryUsage > 80 ? 'bg-rose-500' : 'bg-indigo-500'}`} style={{ width: `${memoryUsage}%` }} />
            </div>
          </div>

          {/* Efficiency Analysis Card (New Block) */}
          <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-4">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-tighter mb-3 flex items-center gap-2">
                <Zap className="w-3 h-3 text-amber-400"/> Efficiency Monitor
            </h3>
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-black/20 p-2 rounded-xl border border-white/5">
                    <div className="text-[9px] text-slate-500 font-bold mb-1 uppercase">Actual Data</div>
                    <div className="text-lg font-black text-indigo-400">{actualDataSlots} <span className="text-[10px] font-medium text-slate-600">Slots</span></div>
                </div>
                <div className="bg-black/20 p-2 rounded-xl border border-white/5">
                    <div className="text-[9px] text-slate-500 font-bold mb-1 uppercase">Waste Rate</div>
                    <div className={`text-lg font-black ${wasteRate > 30 ? 'text-rose-500' : 'text-emerald-400'}`}>
                        {wasteRate}%
                    </div>
                </div>
            </div>
            <div className="mt-3 flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                    <TrendingDown className={`w-3 h-3 ${wasteRate > 30 ? 'text-rose-400' : 'text-slate-500'}`}/>
                    <span className="text-[10px] text-slate-500 font-bold">Fragmentation Loss</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">{wasteSlots} Slots</span>
            </div>
          </div>

          <div className="bg-slate-800/40 border border-slate-700 rounded-2xl flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="p-4 border-b border-slate-700 bg-slate-800/20">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-tighter flex items-center gap-2">
                <Activity className="w-3 h-3 text-indigo-500"/> Active Queue ({requests.length})
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
              {requests.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-2 opacity-50">
                  <Search className="w-8 h-8" />
                  <span className="text-xs">No active sessions</span>
                </div>
              ) : (
                [...requests].reverse().map(req => (
                  <div 
                    key={req.id}
                    onMouseEnter={() => setHoveredReqId(req.id)}
                    onMouseLeave={() => setHoveredReqId(null)}
                    className={`relative p-3 rounded-xl border transition-all duration-200 cursor-pointer overflow-hidden
                      ${hoveredReqId === req.id 
                        ? 'bg-indigo-500/10 border-indigo-500 shadow-lg shadow-indigo-500/10' 
                        : 'bg-slate-800/30 border-slate-700 hover:border-slate-500'}`}
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: req.hexColor }}></div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-200">{req.id}</span>
                      <span className="text-[10px] text-slate-500 font-mono uppercase">{req.intent}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="h-28 bg-slate-900/50 border border-slate-700 rounded-2xl p-3 font-mono text-[10px] overflow-hidden flex flex-col flex-none">
             <div className="text-slate-600 mb-1 border-b border-slate-800 pb-1 flex items-center gap-1">
               <Info className="w-3 h-3"/> KERNEL_LOG
             </div>
             <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
               {logs.map((log, i) => (
                 <div key={i} className="flex gap-2">
                    <span className="text-slate-700">[{log.time}]</span>
                    <span className={log.type === 'error' ? 'text-rose-400' : log.type === 'success' ? 'text-emerald-400' : 'text-indigo-400'}>{log.msg}</span>
                 </div>
               ))}
             </div>
          </div>
        </aside>

        {/* --- Main Area --- */}
        <main className="flex-1 bg-slate-800/30 border border-slate-700 rounded-2xl p-6 flex flex-col relative overflow-hidden min-h-0">
          <div className="flex justify-between items-center mb-8 relative z-10">
            <h2 className="text-lg font-bold flex items-center gap-2 tracking-tight">
              <HardDrive className="w-5 h-5 text-indigo-500" />
              PHYSICAL MEMORY ADDRESS SPACE
            </h2>
            <div className="flex gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-slate-700 rounded-sm border border-slate-600"></div> Free</div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-indigo-500 rounded-sm"></div> Occupied</div>
              {mode === 'standard' && <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-rose-500/40 rounded-sm"></div> Frag.</div>}
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center min-h-0">
            <div className={`grid gap-3 transition-all duration-500 w-full ${mode==='standard' ? 'grid-cols-4' : 'grid-cols-8'}`}>
              {mode === 'standard' 
                ? Array.from({ length: TOTAL_SLOTS/MAX_SEQ_LEN }).map((_, i) => {
                    const startIdx = i * MAX_SEQ_LEN;
                    const chunk = memory.slice(startIdx, startIdx + MAX_SEQ_LEN);
                    const occupied = chunk.find(s => s !== null);
                    const isHovered = occupied && (occupied.reqId === hoveredReqId || occupied.reqId === lastAddedReq?.id);
                    const isDimmed = (hoveredReqId || lastAddedReq) && occupied && occupied.reqId !== (hoveredReqId || lastAddedReq?.id);

                    return (
                      <div key={i} className={`relative bg-slate-900/80 border-2 p-3 rounded-2xl transition-all duration-300 h-24 flex flex-col justify-between
                        ${occupied ? 'border-slate-700 shadow-lg' : 'border-dashed border-slate-700/50'}
                        ${isHovered ? 'border-indigo-500 ring-4 ring-indigo-500/20 scale-105 z-20' : ''}
                        ${isDimmed ? 'opacity-20 blur-[1px]' : ''}
                      `}>
                        {occupied ? (
                          <>
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-black text-slate-500">{occupied.id}</span>
                              <div className="w-2 h-2 rounded-full" style={{backgroundColor: occupied.hexColor}}></div>
                            </div>
                            <div className="grid grid-cols-4 gap-1 h-10">
                              {chunk.map((slot, sIdx) => (
                                <div key={sIdx} className="rounded bg-slate-800 border border-white/5 overflow-hidden">
                                  {slot?.type === 'data' && <div className="w-full h-full" style={{ backgroundColor: slot.hexColor }}></div>}
                                  {slot?.type === 'waste' && <div className="w-full h-full bg-rose-500/20" style={{backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(244,63,94,0.1) 5px, rgba(244,63,94,0.1) 10px)'}}></div>}
                                </div>
                              ))}
                            </div>
                          </>
                        ) : <div className="h-full flex items-center justify-center text-slate-800 text-[8px] font-black tracking-widest">UNUSED</div>}
                      </div>
                    );
                  })
                : Array.from({ length: TOTAL_SLOTS/BLOCK_SIZE }).map((_, i) => {
                    const startIdx = i * BLOCK_SIZE;
                    const block = memory.slice(startIdx, startIdx + BLOCK_SIZE);
                    const occupied = block.find(s => s !== null);
                    const isHovered = occupied && (occupied.reqId === hoveredReqId || occupied.reqId === lastAddedReq?.id);
                    const isDimmed = (hoveredReqId || lastAddedReq) && occupied && occupied.reqId !== (hoveredReqId || lastAddedReq?.id);

                    return (
                      <div key={i} className={`relative bg-slate-900/80 border-2 rounded-xl transition-all duration-300 h-16 flex flex-col items-center justify-center
                        ${occupied ? 'border-slate-700 shadow-md' : 'border-dashed border-slate-800'}
                        ${isHovered ? 'border-indigo-500 ring-4 ring-indigo-500/20 scale-110 z-20 shadow-indigo-500/40' : ''}
                        ${isDimmed ? 'opacity-10 blur-[2px]' : ''}
                      `}>
                        <span className="absolute top-1 left-1.5 text-[7px] text-slate-600 font-mono font-bold">P{i}</span>
                        {occupied ? (
                            <div className="w-8 h-8 rounded-lg shadow-lg flex items-center justify-center text-white" style={{ backgroundColor: occupied.hexColor }}>
                              <User className="w-4 h-4 opacity-80" />
                            </div>
                        ) : <div className="w-1.5 h-1.5 rounded-full bg-slate-800"></div>}
                      </div>
                    );
                  })
              }
            </div>
          </div>
        </main>
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
      `}</style>
    </div>
  );
};

export default App;