'use client';

import { useEffect, useState, useRef } from 'react';//useRef 임포트
import { supabase } from '@/utils/supabase';//supabase 임포트 경로 수정
import * as XLSX from 'xlsx'; // 엑셀 라이브러리
import Link from "next/link";

// 카테고리 및 내역 타입 정의
interface Category {
  id: number;
  code: string;
  name: string;
}

// 내역 타입 정의
interface CashLog {
  id: number;
  transaction_date: string;
  type: 'IN' | 'OUT';
  method: 'card' | 'cash';
  category: string;
  description: string;
  amount: number;
  memo: string;
}

//메타데이터 설정 (app/layout.tsx로 이동)
export default function CashbookPage() {
  const [logs, setLogs] = useState<CashLog[]>([]);//내역 상태
  const [categories, setCategories] = useState<Category[]>([]);//카테고리 상태
  const [loading, setLoading] = useState(true);//로딩 상태
  const [isModalOpen, setIsModalOpen] = useState(false);//신규/수정 모달 상태
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);//카테고리 모달 상태
  const [editingId, setEditingId] = useState<number | null>(null);//수정 중인 내역 ID 상태
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false); //통계 모달 상태

  const [isConfirmOpen, setIsConfirmOpen] = useState(false); //커스텀 확인창 상태
  const [confirmConfig, setConfirmConfig] = useState({ title: '', message: '', action: () => {} });//커스텀 확인창 설정 상태

  // [추가] 카테고리 포커스 및 알림을 위한 Ref
  const catCodeRef = useRef<HTMLInputElement>(null);
  const catNameRef = useRef<HTMLInputElement>(null);

  // 오늘 날짜를 "YYYY-MM-DD" 형식으로 반환하는 함수
  const getToday = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  //커스텀 확인창 호출 함수
  const openConfirm = (title: string, message: string, action: () => void) => {
    setConfirmConfig({ title, message, action });
    setIsConfirmOpen(true);
  };

  // 폼 데이터 상태 (신규/수정 공통)
  const [formData, setFormData] = useState({
    transaction_date: getToday(),
    type: 'OUT' as 'IN' | 'OUT',
    method: 'cash' as 'card' | 'cash',
    category: '',
    description: '',
    amount: '',
    memo: '',
  });

  //신규 카테고리 입력 상태
  const [newCat, setNewCat] = useState({ code: '', name: '' });

  // 초기 데이터 로드 함수
  const initData = async () => {
    setLoading(true);
    const { data: catData } = await supabase.from('categories').select('*').order('code');//카테고리를 코드 순으로 정렬하여 가져옵니다.
    if (catData) {//카테고리 데이터를 상태에 저장합니다.
      setCategories(catData);//카테고리가 하나라도 존재하고, 현재 폼 데이터에 카테고리가 설정되어 있지 않다면, 첫 번째 카테고리를 기본값으로 설정합니다.
      if (catData.length > 0 && !formData.category) {
        setFormData(prev => ({ ...prev, category: catData[0].code }));//첫 번째 카테고리의 코드를 기본값으로 설정합니다.
      }
    }
    
    //내역 데이터를 트랜잭션 날짜 기준으로 내림차순 정렬하여 가져옵니다.
    const { data: logData } = await supabase.from('cash_logs').select('*').order('transaction_date', { ascending: false });
    if (logData) setLogs(logData);
    setLoading(false);
  };

  //컴포넌트가 처음 렌더링될 때 초기 데이터를 로드합니다.
  useEffect(() => { initData(); }, []);

  //신규 저장 및 수정을 동시에 처리
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 폼 요소들을 가져옵니다.
    const form = e.currentTarget as HTMLFormElement;

    // 1. 내역 필드 체크
    if (!formData.description.trim()) {
      const descInput = form.elements.namedItem('description') as HTMLInputElement;
      descInput.setCustomValidity('사용 내역을 입력해주세요.');
      descInput.reportValidity();
      return;
    }

    // 2. 금액 필드 체크
    if (!formData.amount) {
      const amountInput = form.elements.namedItem('amount') as HTMLInputElement;
      amountInput.setCustomValidity('금액을 입력해주세요.');
      amountInput.reportValidity();
      return;
    }

    // 3. 카테고리 체크 (카테고리가 하나도 없는 경우)
    const payload = {
      ...formData,
      amount: Number(formData.amount)
    };

    // 수정 모드인지 여부에 따라 적절한 API 호출을 합니다.
    if (editingId) {
      const { error } = await supabase.from('cash_logs').update(payload).eq('id', editingId);
      if (error) alert('수정 오류: ' + error.message);
    } else {
      const { error } = await supabase.from('cash_logs').insert([payload]);
      if (error) alert('저장 오류: ' + error.message);
    }

    resetForm();
    initData();
  };

  // 더블클릭 시 수정 모드로 전환
  const handleEdit = (log: CashLog) => {
    setEditingId(log.id);
    setFormData({
      transaction_date: log.transaction_date,
      type: log.type,
      method: log.method,
      category: log.category,
      description: log.description,
      amount: String(log.amount),
      memo: log.memo || '',
    });
    setIsModalOpen(true);
  };

  // 내역 삭제 핸들러
  const handleDeleteLog = () => {
    if (!editingId) return;
    // 브라우저 confirm 대신 커스텀 모달 호출
    openConfirm(
      '내역 삭제',
      '해당 내역을 정말 삭제하시겠습니까?',
      async () => {
        const { error } = await supabase.from('cash_logs').delete().eq('id', editingId);
        if (error) alert('삭제 실패: ' + error.message);
        resetForm();
        initData();
      }
    );
  };

  // 폼 초기화 공통 함수
  const resetForm = () => {
    setFormData({
      transaction_date: getToday(),
      type: 'OUT',
      method: 'cash',
      category: categories[0]?.code || '',
      description: '',
      amount: '',
      memo: '',
    });
    setEditingId(null);
    setIsModalOpen(false);
  };

  // 카테고리 저장 핸들러
  const handleAddCategory = async () => {
    // 1. 코드 입력 확인
    if (!newCat.code.trim()) {
      catCodeRef.current?.setCustomValidity('코드를 입력해주세요. (예: 10)');
      catCodeRef.current?.reportValidity();
      return;
    }

    // 2. 명칭 입력 확인
    if (!newCat.name.trim()) {
      catNameRef.current?.setCustomValidity('명칭을 입력해주세요. (예: 식비)');
      catNameRef.current?.reportValidity();
      return;
    }

    // 데이터 저장 로직 (기존과 동일)
    await supabase.from('categories').insert([{ 
      code: newCat.code.toUpperCase().trim(), 
      name: newCat.name.trim() 
    }]);
    
    setNewCat({ code: '', name: '' });
    initData();
  };

  // 카테고리 삭제 핸들러
  const handleDeleteCategory = (id: number, name: string) => {
    openConfirm(
      '카테고리 삭제',
      `'${name}' 카테고리를 삭제하시겠습니까?`,
      async () => {
        await supabase.from('categories').delete().eq('id', id);
        initData();
      }
    );
  };

  // 카테고리 코드로 명칭을 찾는 헬퍼 함수
  const getCategoryName = (code: string) => categories.find(c => c.code === code)?.name || code;

  // 엑셀 다운로드 핸들러
  const downloadExcel = () => {
    if (logs.length === 0) return alert('다운로드할 내역이 없습니다.');

    // 1. 데이터 가공 (엑셀에 표시될 한글 헤더 설정)
    const excelData = logs.map(log => ({
      '날짜': log.transaction_date,
      '구분': log.type === 'IN' ? '수입' : '지출',
      '카테고리': getCategoryName(log.category),
      '내역': log.description,
      '결제수단': log.method === 'card' ? '카드' : '현금',
      '금액': log.amount,
      '메모': log.memo || ''
    }));

    // 2. 워크시트 생성
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "현금출납부");

    // 3. 파일 다운로드 (파일명에 오늘 날짜 포함)
    const today = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `Money_내역_${today}.xlsx`);
  };

  // [추가] 월별 데이터 집계 함수
  const getMonthlyStats = () => {
    const stats: { [key: string]: { in: number; out: number } } = {};
    
    logs.forEach(log => {
      const month = log.transaction_date.substring(0, 7); // "YYYY-MM" 추출
      if (!stats[month]) stats[month] = { in: 0, out: 0 };
      
      if (log.type === 'IN') stats[month].in += log.amount;
      else stats[month].out += log.amount;
    });

    // 최신순 정렬
    return Object.entries(stats).sort((a, b) => b[0].localeCompare(a[0]));
  };

  // 통계 전용 엑셀 다운로드
  const downloadStatsExcel = () => {
    const statsData = getMonthlyStats().map(([month, data]) => ({
      '연월': month,
      '수입 총액': data.in,
      '지출 총액': data.out,
      '순수익': data.in - data.out
    }));

    const worksheet = XLSX.utils.json_to_sheet(statsData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "월별통계");
    XLSX.writeFile(workbook, `Money_월별통계_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // [계산] 최종 잔액 합계 로직
  const totalBalance = logs.reduce((acc, log) => {
    return log.type === 'IN' ? acc + log.amount : acc - log.amount;
  }, 0);

  //
  return (
    <div className="w-full h-screen max-w-[1400px] mx-auto p-4 font-sans text-gray-800 flex flex-col">

      <div className="flex-none">
        <div className="flex justify-between items-center mb-2 py-1">
        <h1 className="text-xl font-black text-blue-500">
          💰 <span className={`text-xl font-black ${totalBalance >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
              {totalBalance.toLocaleString()}
              </span></h1>
        <div className="flex gap-2">

          {/* [수정] 차계부 링크 - 배경/외곽선 없이 아이콘만 배치 */}
          <Link 
            href="https://my-car-log.vercel.app" 
            className="flex items-center justify-center transition-opacity hover:opacity-70" // 호버 시 살짝 투명해지는 효과
            title="주유 관리 바로가기"
          >
            {/* src 경로: '/GV80.jpg' (public 폴더 기준) */}
            {/* 크기: w-9 h-7로 직사각형 비율을 유지하면서 옆 버튼들과 높이를 맞춥니다. */}
            <img 
              src="/GV80.jpg" 
              alt="GV80" 
              className="w-10 h-10 rounded-lg object-cover shadow-sm border border-gray-100" // rounded-lg로 모서리만 부드럽게
            />
          </Link>

          {/* 엑셀 다운로드 버튼 */}
          <button 
            onClick={downloadExcel}
            className="w-10 h-10 bg-green-100 text-green-600 rounded-lg hover:bg-green-600 hover:text-white transition-all flex items-center justify-center shadow-sm border border-green-300"
            title="엑셀 다운로드"
          >
            {/* leading-none을 주어 이모지 자체의 줄간격을 없앱니다. */}
            <span className="text-2xl leading-none">📊</span> 
          </button>

          {/* [추가] 통계 버튼 */}
          <button 
            onClick={() => setIsStatsModalOpen(true)}
            className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all shadow-sm border border-indigo-200"
            title="월별 통계"
          >
            <span className="text-2xl leading-none">📈</span>
          </button>

          <button 
            onClick={() => setIsCategoryModalOpen(true)} 
            // flex, items-center, justify-center가 핵심입니다.
            className="w-10 h-10 bg-gray-600 rounded-lg hover:bg-gray-700 flex items-center justify-center transition-colors"
          >
            {/* leading-none은 이모지 주변의 보이지 않는 줄간격을 0으로 만듭니다. */}
            <span className="text-2xl leading-none flex">⚙️</span>
          </button>

          <button 
            onClick={() => { resetForm(); setIsModalOpen(true); }} 
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md">+ NEW
          </button>
        </div>
        
      </div>

      {/* 2. [수정] 목록 헤더 바로 위에 잔액 표시 */}
      <div className="flex justify-between items-end mb-2 px-1">
        <span className="text-xs font-bold text-gray-400 tracking-wider"></span>
        <div className="text-right">
          {/* <span className="text-[10px] font-bold text-gray-400 uppercase block mb-0.5">Total Balance</span> */}
          {/* <span className={`text-xl font-black ${totalBalance >= 0 ? 'text-blue-600' : 'text-red-500'}`}>*/}
          {/* {totalBalance.toLocaleString()}*/}
          {/* </span>*/}
        </div>
      </div>
      </div>

      <div className="flex-1 min-h-0 bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="h-full overflow-y-auto">
        
        <table className="w-full text-left border-collapse table-fixed">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-70 border-b text-gray-700 text-xs uppercase">
              <th className="p-3 w-[80px] md:w-[100px] font-semibold text-center">날짜</th>
              <th className="p-3 w-[55px] md:w-[70px] font-semibold text-center">구분</th>
              <th className="p-3 w-[65px] md:w-[130px] font-semibold">분류</th>
              <th className="p-3 w-auto font-semibold text-center">내역</th>
              <th className="p-3 w-[90px] md:w-[150px] font-semibold text-center">금액</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={5} className="p-10 text-center text-sm text-gray-400">로딩 중...</td></tr>
            ) : (
              logs.map((log) => (
                <tr 
                  key={log.id} 
                  onDoubleClick={() => handleEdit(log)} // [추가] 더블클릭 이벤트
                  className="hover:bg-blue-50/30 transition-colors cursor-pointer select-none"
                  title="더블클릭하여 수정"
                >
                  <td className="p-3 text-center text-sm text-gray-600 tabular-nums">
                    {log.transaction_date.replace(/-/g, '.')}
                  </td>
                  <td className={`p-3 text-center text-sm font-bold ${log.type === 'IN' ? 'text-blue-600' : 'text-red-500'}`}>
                    {log.type === 'IN' ? '수입' : '지출'}
                  </td>
                  <td className="p-3 truncate">
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-700 text-sm truncate">{getCategoryName(log.category)}</span>
                      <span className="text-[12px] text-gray-500 uppercase">{log.method}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="text-sm text-gray-800 font-medium truncate md:whitespace-normal">
                      {log.description}
                    </div>
                    {log.memo && <div className="text-[12px] text-gray-500 italic mt-0.5 truncate">- {log.memo}</div>}
                  </td>
                  <td className={`p-3 text-right font-black text-sm md:text-base tabular-nums ${log.type === 'IN' ? 'text-blue-600' : 'text-red-500'}`}>
                    {log.amount.toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* 신규/수정 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200 shadow-2xl">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h2 className="font-bold text-gray-700">{editingId ? '📝 내역 수정' : '✍️ 신규 내역'}</h2>
              <button onClick={resetForm} className="text-gray-400 text-2xl px-2">&times;</button>
            </div>
            
            {/* <form> 안에 있을 때: 명칭(name)으로 찾는 게 편함 (현재 내역 입력창 필수 확인 방식) */}
            <form onSubmit={handleSubmit} 
                className="p-6 space-y-3" 
                noValidate // [이게 핵심!] 이걸 지우면 브라우저의 기본 Validation이 활성화되어, 커스텀 메시지가 제대로 표시되지 않습니다. (즉 그냥 이 입력란을 작성하세요 라고 뜸)
            >
              {/* 입력 필드들 (날짜, 구분, 결제수단, 카테고리, 내역, 금액, 메모) */}
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={formData.transaction_date} onChange={(e) => setFormData({...formData, transaction_date: e.target.value})} className="p-3 bg-gray-100 rounded-xl text-sm outline-none" />
                <div className="inline-flex items-center bg-gray-100 rounded-xl p-1 border border-gray-200 shadow-inner w-full">
                  <label className={`flex-1 cursor-pointer text-center rounded-lg px-3 py-2 text-sm font-bold transition-colors ${formData.type === 'OUT' ? 'bg-white text-red-500 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                    <input
                      type="radio"
                      name="type"
                      value="OUT"
                      checked={formData.type === 'OUT'}
                      onChange={() => setFormData({...formData, type: 'OUT'})}
                      className="hidden"
                    />
                    지출
                  </label>
                  <label className={`flex-1 cursor-pointer text-center rounded-lg px-3 py-2 text-sm font-bold transition-colors ${formData.type === 'IN' ? 'bg-white text-blue-500 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                    <input
                      type="radio"
                      name="type"
                      value="IN"
                      checked={formData.type === 'IN'}
                      onChange={() => setFormData({...formData, type: 'IN'})}
                      className="hidden"
                    />
                    수입
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="inline-flex items-center bg-gray-100 rounded-xl p-1 border border-gray-200 shadow-inner w-full">
                  <label className={`flex-1 cursor-pointer text-center rounded-lg px-3 py-2 text-sm font-bold transition-colors ${formData.method === 'cash' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                    <input
                      type="radio"
                      name="method"
                      value="cash"
                      checked={formData.method === 'cash'}
                      onChange={() => setFormData({...formData, method: 'cash'})}
                      className="hidden"
                    />
                    현금
                  </label>
                  <label className={`flex-1 cursor-pointer text-center rounded-lg px-3 py-2 text-sm font-bold transition-colors ${formData.method === 'card' ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                    <input
                      type="radio"
                      name="method"
                      value="card"
                      checked={formData.method === 'card'}
                      onChange={() => setFormData({...formData, method: 'card'})}
                      className="hidden"
                    />
                    카드
                  </label>
                </div>
                <select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} className="p-3 bg-gray-100 rounded-xl text-sm outline-none">
                  {categories.map(cat => <option key={cat.code} value={cat.code}>{cat.name}</option>)}
                </select>
              </div>
              {/* 내역 입력 필드 */}
              <input 
                name="description" // name 추가
                type="text" 
                placeholder="어디에 쓰셨나요?" 
                required
                value={formData.description} 
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                onInput={(e) => (e.currentTarget as HTMLInputElement).setCustomValidity('')} // 메시지 초기화
                className="w-full p-3 bg-gray-100 rounded-xl text-sm outline-none" 
              />
              
              {/* 금액 입력 필드 */}
              <input 
                name="amount" // name 추가
                type="number" 
                placeholder="0" 
                required
                value={formData.amount} 
                onChange={(e) => setFormData({...formData, amount: e.target.value})} 
                onInput={(e) => (e.currentTarget as HTMLInputElement).setCustomValidity('')} // 메시지 초기화
                className="w-full p-4 bg-blue-50 text-blue-600 text-2xl font-black text-right rounded-2xl outline-none" 
              />
              <input type="text" placeholder="메모 (선택)" value={formData.memo} onChange={(e) => setFormData({...formData, memo: e.target.value})} className="w-full p-3 bg-gray-100 rounded-xl text-sm outline-none" />
              
              {/* [수정된 버튼 영역] */}
              <div className="flex flex-col gap-2 pt-4">
                <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-lg shadow-lg hover:bg-blue-700 transition-all">
                  {editingId ? '수정 완료' : '저장'}
                </button>
                
                <div className="flex gap-2">
                  {editingId && (
                    <button type="button" onClick={handleDeleteLog} className="flex-1 py-3 bg-red-50 text-red-500 rounded-xl font-bold text-sm hover:bg-red-100 transition-colors">
                      삭제
                    </button>
                  )}
                  <button type="button" onClick={resetForm} className="flex-1 py-3 bg-gray-100 text-gray-500 rounded-xl font-bold text-sm hover:bg-gray-200 transition-colors">
                    취소
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 카테고리 모달 */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in duration-200">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50 font-bold text-sm">
              <span>🏷️ 카테고리 설정</span>
              <button onClick={() => setIsCategoryModalOpen(false)} className="text-gray-400 text-2xl px-2">&times;</button>
            </div>
            <div className="p-5">
              <div className="space-y-2 mb-6 max-h-48 overflow-y-auto pr-1">
                {categories.map(cat => (
                  <div key={cat.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-sm font-bold">{cat.name} <span className="text-[10px] font-normal text-gray-400 ml-1">{cat.code}</span></span>
                    <button onClick={() => handleDeleteCategory(cat.id, cat.name)} className="text-red-400 font-bold text-xs">삭제</button>
                  </div>
                ))}
              </div>
              <div className="bg-blue-50 p-4 rounded-2xl space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input 
                    ref={catCodeRef} // [추가]
                    type="text" 
                    placeholder="코드" 
                    value={newCat.code} 
                    onChange={(e) => {
                      e.target.setCustomValidity(''); // 입력 시 메시지 초기화
                      setNewCat({...newCat, code: e.target.value});
                    }} 
                    className="w-full p-2.5 rounded-lg text-xs border-none outline-none" 
                  />
                  <input 
                    ref={catNameRef} // [추가]
                    type="text" 
                    placeholder="명칭" 
                    value={newCat.name} 
                    onChange={(e) => {
                      e.target.setCustomValidity(''); // 입력 시 메시지 초기화
                      setNewCat({...newCat, name: e.target.value});
                    }} 
                    className="w-full p-2.5 rounded-lg text-xs border-none outline-none" 
                  />
                </div>
                {/*<form> 밖에 있을 때: 명칭(Ref)로 직접 찍는 게 편함 (현재 카테고리 입력창 필수확인 방식) */}
                <button onClick={handleAddCategory} className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-bold text-xs">저장</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 월별 통계 모달 */}
      {isStatsModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in duration-200">
            <div className="p-5 border-b flex justify-between items-center bg-indigo-50">
              <h2 className="font-bold text-indigo-900 text-lg">📈 월별 현황</h2>
              <button onClick={() => setIsStatsModalOpen(false)} className="text-indigo-300 text-2xl">&times;</button>
            </div>
            
            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
              {getMonthlyStats().map(([month, data]) => (
                <div key={month} className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex justify-between items-center">
                  <div>
                    <div className="text-xx text-gray-600 font-bold mb-1">{month}</div>
                    <div className="flex gap-3 text-sm">
                      <span className="text-blue-600">↑ {data.in.toLocaleString()}</span>
                      <span className="text-red-600">↓ {data.out.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[12px] text-gray-600">잔액</div>
                    <div className={`font-black text-lg ${(data.in - data.out) >= 0 ? 'text-gray-700' : 'text-red-500'}`}>
                      {(data.in - data.out).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
              {logs.length === 0 && <div className="text-center text-gray-400 py-10">데이터가 없습니다.</div>}
            </div>

            <div className="p-4 bg-gray-50 border-t flex gap-2">
              <button 
                onClick={downloadStatsExcel}
                className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold text-sm shadow-md hover:bg-green-700 transition-all flex justify-center items-center gap-2"
              >
                📊 엑셀 저장
              </button>
              <button 
                onClick={() => setIsStatsModalOpen(false)}
                className="flex-1 py-3 bg-white text-gray-500 rounded-xl font-bold text-sm border border-gray-200"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 커스텀 확인창 (삭제 시) */}
      {isConfirmOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-6">
          <div className="bg-white rounded-3xl w-full max-w-xs overflow-hidden shadow-2xl animate-in zoom-in duration-200">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                ⚠️
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">{confirmConfig.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                {confirmConfig.message}
              </p>
            </div>
            <div className="flex border-t">
              <button 
                onClick={() => setIsConfirmOpen(false)}
                className="flex-1 py-4 text-sm font-bold text-gray-400 hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button 
                onClick={() => {
                  confirmConfig.action();
                  setIsConfirmOpen(false);
                }}
                className="flex-1 py-4 text-sm font-bold text-red-500 hover:bg-red-50 transition-colors border-l"
              >
                삭제하기
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}