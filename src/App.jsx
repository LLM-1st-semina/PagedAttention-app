import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, Layers, LayoutGrid, User, MessageSquare, 
  Plus, Trash2, Search, Activity, Cpu, ArrowRight, 
  HardDrive, Info, AlertCircle, CheckCircle2, TrendingDown, Zap,
  AlertTriangle, FileText, BrainCircuit
} from 'lucide-react';

// --- 설정 ---
const TOTAL_SLOTS = 64;       
const BLOCK_SIZE = 2;         
const MAX_SEQ_LEN = 8;        // Standard 모드의 기본 단위

const COLORS = [
  '#6366f1', '#f43f5e', '#10b981', '#f59e0b', 
  '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16',
  '#0ea5e9', '#f97316', '#14b8a6', '#d946ef'
];

const RAW_DATA = [
  { id: 'TK-1001', intent: 'Account_Unlock', text: "로그인이 안 됩니다. 계정이 잠긴 것 같아요.", len: 5 },
  { id: 'TK-1002', intent: 'Refund_Request', text: "구독 취소했는데 결제가 되었습니다.", len: 6 },
  { id: 'TK-1003', intent: 'Bug_Report', text: "API 500 에러 발생 (로그 첨부).", len: 12 }, 
  { id: 'TK-1004', intent: 'Feature_Request', text: "다크 모드 기능은 언제 추가되나요?", len: 3 },
  { id: 'TK-1005', intent: 'Payment_Change', text: "결제 카드를 법인 카드로 변경하고 싶습니다.", len: 5 },
  { id: 'TK-1006', intent: 'General_Inquiry', text: "이 서비스 무료 체험 기간이 며칠인가요?", len: 4 },
  { id: 'TK-1007', intent: 'Bug_Report', text: "대시보드 데이터 갱신 안됨.", len: 3 },
  { id: 'TK-1008', intent: 'Account_Closure', text: "탈퇴 버튼이 안 보입니다.", len: 2 },
  { id: 'TK-1009', intent: 'Feature_Request', text: "PDF 내보내기 기능 필요함. 긴급.", len: 10 }, 
  { id: 'TK-1010', intent: 'Invoicing', text: "영수증 이메일 발송 요청.", len: 3 },
];

const FULL_DATASET = Array.from({ length: 50 }).map((_, i) => {
    const template = RAW_DATA[i % RAW_DATA.length];
    const stdBlocks = template.len > 6 ? 2 : 1; 
    
    return { 
        ...template, 
        id: `TK-${1000+i+1}`, 
        hexColor: COLORS[i % COLORS.length],
        stdBlocks 
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
  const actualDataSlots = requests.reduce((acc, req) => acc + req.len, 0);
  const wasteSlots = totalAllocatedSlots - actualDataSlots;
  const wasteRate = totalAllocatedSlots > 0 ? Math.round((wasteSlots / totalAllocatedSlots) * 100) : 0;

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

  // Allocation Logic
  const allocateToMemory = (template, currentMemory) => {
    const newReqId = template.id; 
    const requiredLen = template.len;
    let newMemory = [...currentMemory];
    let allocatedIndices = [];

    if (mode === 'standard') {
      const neededSlots = template.stdBlocks * MAX_SEQ_LEN; 
      
      let startIdx = -1;
      for (let i = 0; i <= TOTAL_SLOTS - neededSlots; i++) {
        if (newMemory.slice(i, i + neededSlots).every(s => s === null)) {
          startIdx = i;
          break;
        }
      }

      if (startIdx !== -1) {
         for(let i=0; i<neededSlots; i++) {
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

  const handleAddWithContextWindow = () => {
    const data = FULL_DATASET[nextReqIndex % FULL_DATASET.length];
    
    let result = allocateToMemory(data, memory);
    
    let tempMemory = [...memory];
    let tempRequests = [...requests];
    let evictedCount = 0;

    // [수정됨] Evict FIFO (Sliding Window)
    // 메모리가 부족하면 가장 오래된 요청(0번 인덱스)부터 삭제하여 공간 확보
    while (!result.success && tempRequests.length > 0) {
        // FIFO Victim Selection: 가장 오래된 요청 선택
        const victim = tempRequests[0]; 
        
        // Free Memory
        victim.allocatedIndices.forEach(idx => tempMemory[idx] = null);
        tempRequests.shift(); // Remove from front (Queue 방식)
        evictedCount++;

        // Retry Allocation
        result = allocateToMemory(data, tempMemory);
    }

    if (result.success) {
        setMemory(result.newMemory);
        const newReq = { ...data, allocatedIndices: result.allocatedIndices, status: 'active' };
        setRequests([...tempRequests, newReq]);
        setLastAddedReq(newReq);
        setNextReqIndex(prev => prev + 1);

        if (evictedCount > 0) {
            addLog(`Context Window 확보: 오래된 대화 ${evictedCount}건 삭제됨`, "warning");
        } else {
            addLog(`${data.id} 할당 성공`, "success");
        }
    } else {
        addLog(`치명적 오류: ${data.id} 할당 불가 (메모리 부족)`, "error");
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
    addLog(`${targetReq.id} 수동 해제됨`, "info");
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#0f172a] text-slate-200 font-sans p-6 overflow-hidden box-border">
      
      {/* Header */}
      <header className="flex-none mb-4 grid grid-cols-12 gap-4 h-24">
        <div className="col-span-8 bg-slate-800/50 backdrop-blur-md border border-slate-700 rounded-2xl p-4 flex items-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
          {displayReq ? (
             <div className="flex gap-6 w-full items-center animate-in fade-in slide-in-from-left-4">
                <div className="flex-none w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold shadow-lg overflow-hidden relative" style={{ backgroundColor: displayReq.hexColor }}>
                  <User className="w-8 h-8 opacity-20 absolute" />
                  <span className="relative z-10 text-lg font-black">{displayReq.id.slice(-4)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-xl font-bold text-white tracking-tight">{displayReq.id}</h2>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 border border-slate-600 uppercase tracking-widest">{displayReq.intent}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                      {mode === 'standard' 
                        ? `${displayReq.stdBlocks * 8} Slots (Block x${displayReq.stdBlocks})` 
                        : `Dynamic (${Math.ceil(displayReq.len/2)} Pages)`}
                    </span>
                  </div>
                  <div className="flex items-start gap-2 text-slate-400 bg-black/20 p-1.5 rounded-lg border border-white/5 mt-1">
                    <MessageSquare className="w-4 h-4 mt-0.5 text-indigo-400 shrink-0" />
                    <p className="text-sm italic truncate">"{displayReq.text}"</p>
                  </div>
                </div>
             </div>
          ) : (
             <div className="flex items-center gap-4 text-slate-500">
                <div className="w-10 h-10 rounded-full border-2 border-dashed border-slate-700 flex items-center justify-center animate-spin-slow">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-400 uppercase tracking-widest">SYSTEM STANDBY</h2>
                  <p className="text-xs">데이터 할당을 시작하려면 우측 'Add Ticket' 버튼을 누르세요.</p>
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
            <button onClick={reset} className="p-2 text-slate-500 hover:text-white transition-colors hover:rotate-180 duration-500">
              <RefreshCw className="w-5 h-5"/>
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAddWithContextWindow} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-xl font-bold text-sm shadow-lg shadow-indigo-600/20 transition-all active:scale-95 flex items-center justify-center gap-2">
              <Plus className="w-4 h-4"/> Add Ticket
            </button>
            <button onClick={manualRemove} className="px-4 py-2 border border-slate-600 text-slate-400 hover:bg-slate-700 hover:text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center">
              <Trash2 className="w-4 h-4"/>
            </button>
          </div>
        </div>
      </header>

      <div className="flex gap-6 flex-1 min-h-0">
        {/* Sidebar */}
        <aside className="w-72 flex flex-col gap-4 flex-none">
          {/* VRAM Status */}
          <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">GPU VRAM Status</h3>
              <div className={`px-2 py-0.5 rounded text-[10px] font-bold ${memoryUsage > 80 ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                {memoryUsage}% Occupied
              </div>
            </div>
            <div className="relative h-3 bg-slate-900 rounded-full overflow-hidden mb-2 border border-white/5">
              <div className={`h-full transition-all duration-1000 ease-out ${memoryUsage > 80 ? 'bg-rose-500' : 'bg-indigo-500'}`} style={{ width: `${memoryUsage}%` }}></div>
            </div>
            {memoryUsage >= 90 && (
                <div className="flex items-center gap-1 text-[10px] text-amber-400 font-bold animate-pulse">
                    <AlertTriangle className="w-3 h-3"/> Sliding Window Active (FIFO)
                </div>
            )}
          </div>

          {/* Active Queue List */}
          <div className="bg-slate-800/40 border border-slate-700 rounded-2xl flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="p-3 border-b border-slate-700 bg-slate-800/20">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Context Queue (Oldest Top)</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
              {requests.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-2 opacity-50">
                  <Search className="w-6 h-6" />
                  <span className="text-[10px]">No active context</span>
                </div>
              ) : (
                [...requests].map(req => ( // 역순 제거: 오래된 것이 위에 오도록 (FIFO 시각화)
                  <div 
                    key={req.id}
                    onMouseEnter={() => setHoveredReqId(req.id)}
                    onMouseLeave={() => setHoveredReqId(null)}
                    className={`group relative p-2 rounded-xl border transition-all duration-200 cursor-pointer overflow-hidden
                      ${hoveredReqId === req.id 
                        ? 'bg-indigo-500/10 border-indigo-500 shadow-lg' 
                        : 'bg-slate-800/30 border-slate-700 hover:border-slate-500'}`}
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: req.hexColor }}></div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-200">{req.id}</span>
                      <span className="text-[9px] font-medium text-slate-500 uppercase">{req.intent}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Logs */}
          <div className="h-28 bg-slate-900/50 border border-slate-700 rounded-2xl p-3 font-mono text-[10px] overflow-hidden flex flex-col">
              <div className="text-slate-600 mb-2 flex items-center gap-1 border-b border-slate-800 pb-1">
                <Info className="w-3 h-3"/> SYSTEM_LOG
              </div>
              <div className="space-y-1 overflow-y-auto h-full pb-4 custom-scrollbar">
                {logs.map((log, i) => (
                  <div key={i} className="flex gap-2">
                     <span className="text-slate-700">[{log.time}]</span>
                     <span className={log.type === 'error' ? 'text-rose-400' : log.type === 'warning' ? 'text-amber-400' : log.type === 'success' ? 'text-emerald-400' : 'text-indigo-400'}>
                       {log.msg}
                     </span>
                  </div>
                ))}
              </div>
          </div>
        </aside>

        {/* --- Main Area --- */}
        <main className="flex-1 flex flex-col gap-4 min-w-0">
            
          {/* [추가됨] LOGICAL VIEW (Model View) */}
          <div className="h-24 bg-slate-800/30 border border-slate-700 rounded-2xl p-4 flex flex-col relative overflow-hidden flex-none">
             <div className="flex justify-between items-center mb-2">
                 <h2 className="text-xs font-bold flex items-center gap-2 tracking-tight text-indigo-300">
                   <BrainCircuit className="w-4 h-4" />
                   LOGICAL CONTEXT STREAM (MODEL VIEW)
                 </h2>
                 <span className="text-[9px] text-slate-500 uppercase">Total Tokens: {actualDataSlots}</span>
             </div>
             
             {/* Stream Visualization */}
             <div className="flex-1 bg-slate-900/50 rounded-lg border border-slate-700/50 p-2 flex items-center overflow-x-auto custom-scrollbar gap-0.5">
                 {requests.length === 0 ? (
                     <div className="w-full text-center text-[10px] text-slate-600">Waiting for input...</div>
                 ) : (
                     requests.map((req, i) => (
                         <div 
                            key={req.id} 
                            className={`h-8 flex-none rounded-md flex items-center justify-center text-[9px] font-bold text-white shadow-lg transition-all
                                ${hoveredReqId === req.id ? 'ring-2 ring-white scale-105 z-10' : 'opacity-90'}
                            `}
                            style={{ 
                                width: `${req.len * 8}px`, // 길이에 비례한 너비
                                backgroundColor: req.hexColor,
                                minWidth: '24px'
                            }}
                            onMouseEnter={() => setHoveredReqId(req.id)}
                            onMouseLeave={() => setHoveredReqId(null)}
                         >
                             {req.id.slice(-4)}
                         </div>
                     ))
                 )}
                 {requests.length > 0 && <div className="w-2 h-full bg-indigo-500/20 animate-pulse rounded-full ml-1"></div>}
             </div>
          </div>

          {/* PHYSICAL VIEW */}
          <div className="flex-1 bg-slate-800/30 border border-slate-700 rounded-2xl p-6 flex flex-col relative overflow-hidden min-h-0">
            <div className="relative z-10 flex justify-between items-center mb-4 flex-none">
              <h2 className="text-sm font-bold flex items-center gap-2 tracking-tight text-slate-300">
                <HardDrive className="w-4 h-4 text-slate-400" />
                PHYSICAL MEMORY ADDRESS SPACE
              </h2>
              <div className="flex gap-4 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-slate-700 rounded-sm border border-slate-600"></div> FREE
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-indigo-500 rounded-sm"></div> DATA
                </div>
                {mode === 'standard' && (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-sm relative overflow-hidden border border-rose-500/50 bg-rose-500/20"></div> WASTE
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
              <div className={`grid gap-2 transition-all duration-500 w-full ${mode==='standard' ? 'grid-cols-4' : 'grid-cols-8'}`}>
                {mode === 'standard' 
                  ? Array.from({ length: TOTAL_SLOTS/MAX_SEQ_LEN }).map((_, i) => {
                      const startIdx = i * MAX_SEQ_LEN;
                      const chunk = memory.slice(startIdx, startIdx + MAX_SEQ_LEN);
                      const occupied = chunk.find(s => s !== null);
                      const isHovered = occupied && (occupied.reqId === hoveredReqId || occupied.reqId === lastAddedReq?.id);
                      const isDimmed = (hoveredReqId || lastAddedReq) && occupied && occupied.reqId !== (hoveredReqId || lastAddedReq?.id);

                      return (
                        <div key={i} className={`group relative bg-slate-900/80 border p-2 rounded-xl transition-all duration-300 h-20 flex flex-col justify-between
                          ${occupied ? 'border-slate-700' : 'border-dashed border-slate-700/50'}
                          ${isHovered ? 'border-indigo-500 ring-2 ring-indigo-500/20 z-20' : ''}
                          ${isDimmed ? 'opacity-20 blur-[1px]' : ''}
                        `}>
                          {occupied ? (
                            <>
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-[9px] font-black text-slate-500">{occupied.id}</span>
                                <div className="w-1.5 h-1.5 rounded-full" style={{backgroundColor: occupied.hexColor}}></div>
                              </div>
                              <div className="grid grid-cols-4 gap-0.5 h-full">
                                {chunk.map((slot, sIdx) => (
                                  <div key={sIdx} className="rounded-sm bg-slate-800 border border-white/5 overflow-hidden shadow-inner relative">
                                    {slot?.type === 'data' && (
                                      <div className="absolute inset-0 transition-all" style={{ backgroundColor: slot.hexColor }}></div>
                                    )}
                                    {slot?.type === 'waste' && (
                                      <div className="absolute inset-0 bg-rose-500/20" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(244,63,94,0.1) 3px, rgba(244,63,94,0.1) 6px)' }}></div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </>
                          ) : (
                            <div className="h-full flex items-center justify-center text-slate-700 gap-1">
                              <span className="text-[8px] font-black tracking-widest">UNUSED</span>
                            </div>
                          )}
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
                        <div key={i} className={`relative group h-14 bg-slate-900/80 border rounded-lg transition-all duration-300 flex flex-col items-center justify-center overflow-hidden
                          ${occupied ? 'border-slate-700' : 'border-dashed border-slate-800'}
                          ${isHovered ? 'border-indigo-500 ring-2 ring-indigo-500/20 z-20' : ''}
                          ${isDimmed ? 'opacity-10 blur-[2px]' : ''}
                        `}>
                          <span className="absolute top-0.5 left-1 text-[6px] text-slate-600 font-mono font-bold z-10">P{i}</span>
                          {occupied ? (
                            <div className="w-full h-full flex flex-col p-0.5 pt-3">
                                <div className="flex-1 flex gap-0.5">
                                    {block.map((slot, sIdx) => (
                                        <div key={sIdx} className="flex-1 rounded-sm overflow-hidden bg-slate-800 border border-white/5 relative shadow-inner">
                                            {slot?.type === 'data' && (
                                                <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: slot.hexColor }}></div>
                                            )}
                                            {slot?.type === 'reserved' && (
                                                <div className="w-full h-full bg-rose-500/10" style={{backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(244,63,94,0.3) 2px, rgba(244,63,94,0.3) 4px)'}}></div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                          ) : (
                            <div className="w-1 h-1 rounded-full bg-slate-800 group-hover:bg-slate-700 transition-colors"></div>
                          )}
                        </div>
                      );
                    })
                }
              </div>
            </div>
          </div>
        </main>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
        .animate-in { animation: fadeIn 0.4s ease-out forwards; }
        .animate-spin-slow { animation: spin 8s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default App;
