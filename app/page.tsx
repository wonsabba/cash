'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase';
import * as XLSX from 'xlsx'; // [추가] 엑셀 라이브러리

interface Category {
  id: number;
  code: string;
  name: string;
}

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

export default function CashbookPage() {
  const [logs, setLogs] = useState<CashLog[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    transaction_date: new Date().toISOString().split('T')[0],
    type: 'OUT' as 'IN' | 'OUT',
    method: 'cash' as 'card' | 'cash',
    category: '',
    description: '',
    amount: '',
    memo: '',
  });

  const [newCat, setNewCat] = useState({ code: '', name: '' });

  const initData = async () => {
    setLoading(true);
    const { data: catData } = await supabase.from('categories').select('*').order('code');
    if (catData) {
      setCategories(catData);
      if (catData.length > 0 && !formData.category) {
        setFormData(prev => ({ ...prev, category: catData[0].code }));
      }
    }
    const { data: logData } = await supabase.from('cash_logs').select('*').order('transaction_date', { ascending: false });
    if (logData) setLogs(logData);
    setLoading(false);
  };

  useEffect(() => { initData(); }, []);

  // [수정] 신규 저장 및 수정을 동시에 처리
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.description) return alert('내역과 금액을 입력해주세요!');

    const payload = {
      ...formData,
      amount: Number(formData.amount)
    };

    if (editingId) {
      // 수정 모드 (UPDATE)
      const { error } = await supabase.from('cash_logs').update(payload).eq('id', editingId);
      if (error) alert('수정 오류: ' + error.message);
    } else {
      // 신규 모드 (INSERT)
      const { error } = await supabase.from('cash_logs').insert([payload]);
      if (error) alert('저장 오류: ' + error.message);
    }

    resetForm();
    initData();
  };

  // [추가] 더블클릭 시 수정 모드로 전환
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

  // [추가] 내역 삭제 함수
  const handleDeleteLog = async () => {
    if (!editingId) return;
    if (!confirm('이 내역을 삭제하시겠습니까?')) return;

    const { error } = await supabase.from('cash_logs').delete().eq('id', editingId);
    if (error) alert('삭제 실패: ' + error.message);
    
    resetForm();
    initData();
  };

  // [추가] 폼 초기화 공통 함수
  const resetForm = () => {
    setFormData({
      transaction_date: new Date().toISOString().split('T')[0],
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

  const handleAddCategory = async () => {
    if (!newCat.code || !newCat.name) return alert('코드와 이름을 입력하세요!');
    await supabase.from('categories').insert([{ code: newCat.code.toUpperCase().trim(), name: newCat.name.trim() }]);
    setNewCat({ code: '', name: '' });
    initData();
  };

  const handleDeleteCategory = async (id: number) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await supabase.from('categories').delete().eq('id', id);
    initData();
  };

  const getCategoryName = (code: string) => categories.find(c => c.code === code)?.name || code;

  // [추가] 엑셀 다운로드 핸들러
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

  return (
    <div className="w-full max-w-[1400px] mx-auto p-4 font-sans text-gray-800">
      
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-black text-blue-600">💰 Money</h1>
        <div className="flex gap-2">

          {/* [추가] 엑셀 다운로드 버튼 */}
          <button 
            onClick={downloadExcel}
            className="p-2.5 bg-green-50 text-green-600 rounded-xl hover:bg-green-600 hover:text-white transition-all flex items-center gap-1 shadow-sm border border-green-100"
            title="엑셀 다운로드"
          >
            <span className="text-xl">📊</span>
            <span className="hidden md:inline text-xs font-bold">Excel</span>
          </button>
          
          <button onClick={() => setIsCategoryModalOpen(true)} className="bg-gray-100 p-2.5 rounded-xl text-lg hover:bg-gray-200">⚙️</button>
          <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md">+ 신규</button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse table-fixed">
          <thead>
            <tr className="bg-gray-50 border-b text-gray-500 text-xs uppercase">
              <th className="p-3 w-[80px] md:w-[100px] font-semibold text-center">날짜</th>
              <th className="p-3 w-[55px] md:w-[70px] font-semibold text-center">구분</th>
              <th className="p-3 w-[60px] md:w-[130px] font-semibold">분류</th>
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
                  <td className="p-3 text-center text-sm text-gray-500 tabular-nums">
                    {log.transaction_date.replace(/-/g, '.')}
                  </td>
                  <td className={`p-3 text-center text-sm font-bold ${log.type === 'IN' ? 'text-blue-500' : 'text-red-400'}`}>
                    {log.type === 'IN' ? '수입' : '지출'}
                  </td>
                  <td className="p-3 truncate">
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-700 text-sm truncate">{getCategoryName(log.category)}</span>
                      <span className="text-[10px] text-gray-400 uppercase">{log.method}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="text-sm text-gray-800 font-medium truncate md:whitespace-normal">
                      {log.description}
                    </div>
                    {log.memo && <div className="text-[11px] text-gray-400 italic mt-0.5 truncate">ㄴ {log.memo}</div>}
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

      {/* 신규/수정 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200 shadow-2xl">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h2 className="font-bold text-gray-700">{editingId ? '📝 내역 수정' : '✍️ 신규 내역'}</h2>
              <button onClick={resetForm} className="text-gray-400 text-2xl px-2">&times;</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-3">
              {/* 입력 필드들 (날짜, 구분, 결제수단, 카테고리, 내역, 금액, 메모) */}
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={formData.transaction_date} onChange={(e) => setFormData({...formData, transaction_date: e.target.value})} className="p-3 bg-gray-100 rounded-xl text-sm outline-none" />
                <select value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value as any})} className="p-3 bg-gray-100 rounded-xl text-sm outline-none">
                  <option value="OUT">지출</option>
                  <option value="IN">수입</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select value={formData.method} onChange={(e) => setFormData({...formData, method: e.target.value as any})} className="p-3 bg-gray-100 rounded-xl text-sm outline-none">
                  <option value="cash">현금</option>
                  <option value="card">카드</option>
                </select>
                <select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} className="p-3 bg-gray-100 rounded-xl text-sm outline-none">
                  {categories.map(cat => <option key={cat.code} value={cat.code}>{cat.name}</option>)}
                </select>
              </div>
              <input type="text" placeholder="어디에 쓰셨나요?" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="w-full p-3 bg-gray-100 rounded-xl text-sm outline-none" />
              <input type="number" placeholder="0" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} className="w-full p-4 bg-blue-50 text-blue-600 text-2xl font-black text-right rounded-2xl outline-none" />
              <input type="text" placeholder="메모 (선택)" value={formData.memo} onChange={(e) => setFormData({...formData, memo: e.target.value})} className="w-full p-3 bg-gray-100 rounded-xl text-sm outline-none" />
              
              {/* [수정된 버튼 영역] */}
              <div className="flex flex-col gap-2 pt-4">
                <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-lg shadow-lg hover:bg-blue-700 transition-all">
                  {editingId ? '수정 완료' : '저장하기'}
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

      {/* 카테고리 모달은 기존과 동일 */}
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
                    <button onClick={() => handleDeleteCategory(cat.id)} className="text-red-400 font-bold text-xs">삭제</button>
                  </div>
                ))}
              </div>
              <div className="bg-blue-50 p-4 rounded-2xl space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" placeholder="코드" value={newCat.code} onChange={(e) => setNewCat({...newCat, code: e.target.value})} className="w-full p-2.5 rounded-lg text-xs border-none outline-none" />
                  <input type="text" placeholder="이름" value={newCat.name} onChange={(e) => setNewCat({...newCat, name: e.target.value})} className="w-full p-2.5 rounded-lg text-xs border-none outline-none" />
                </div>
                <button onClick={handleAddCategory} className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-bold text-xs">추가</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}