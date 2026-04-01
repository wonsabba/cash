'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase';

interface Category {
  id: number;
  code: string;
  name: string;
}

interface CashLog {
  id: number;
  transaction_date: string;
  type: 'income' | 'expense';
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

  const [formData, setFormData] = useState({
    transaction_date: new Date().toISOString().split('T')[0],
    type: 'expense' as 'income' | 'expense',
    method: 'cash' as 'card' | 'cash',
    category: '',
    description: '',
    amount: '',
    memo: '',
  });

  const [newCat, setNewCat] = useState({ code: '', name: '' });

  const initData = async () => {
    setLoading(true);
    const { data: catData } = await supabase.from('categories').select('*').order('id');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.description) return alert('내역과 금액을 입력해주세요!');
    const { error } = await supabase.from('cash_logs').insert([{ ...formData, amount: Number(formData.amount) }]);
    if (!error) {
      setFormData(prev => ({ ...prev, description: '', amount: '', memo: '' }));
      setIsModalOpen(false);
      initData();
    }
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

  return (
    <div className="w-full max-w-[1400px] mx-auto p-4 font-sans text-gray-800">
      
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-black text-blue-600">💰 현금출납부</h1>
        <div className="flex gap-2">
          <button onClick={() => setIsCategoryModalOpen(true)} className="bg-gray-100 p-2.5 rounded-xl text-lg hover:bg-gray-200 transition-all">⚙️</button>
          <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md hover:bg-blue-700 transition-all">+ 추가</button>
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse table-fixed">
          <thead>
            <tr className="bg-gray-50 border-b text-gray-400 text-xs uppercase">
              <th className="p-3 w-[70px] md:w-[100px] font-semibold text-center">날짜</th>
              <th className="p-3 w-[55px] md:w-[70px] font-semibold text-center">구분</th>
              <th className="p-3 w-[85px] md:w-[130px] font-semibold">분류</th>
              <th className="p-3 w-auto font-semibold">내역</th>
              <th className="p-3 w-[90px] md:w-[150px] font-semibold text-right">금액</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={5} className="p-10 text-center text-sm text-gray-400">로딩 중...</td></tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="p-3 text-center text-sm text-gray-400 tabular-nums">
                    {log.transaction_date.slice(5).replace('-', '/')}
                  </td>
                  <td className={`p-3 text-center text-sm font-bold ${log.type === 'income' ? 'text-blue-500' : 'text-red-400'}`}>
                    {log.type === 'income' ? '수입' : '지출'}
                  </td>
                  <td className="p-3 truncate">
                    <div className="flex flex-col overflow-hidden">
                      <span className="font-bold text-gray-700 text-sm truncate">{getCategoryName(log.category)}</span>
                      <span className="text-[10px] text-gray-300 uppercase leading-tight">{log.method}</span>
                    </div>
                  </td>
                  <td className="p-3 overflow-hidden">
                    <div className="text-sm text-gray-800 font-medium truncate md:whitespace-normal">
                      {log.description}
                    </div>
                    {log.memo && <div className="text-[11px] text-gray-400 italic mt-0.5 truncate">ㄴ {log.memo}</div>}
                  </td>
                  <td className={`p-3 text-right font-black text-sm md:text-base tabular-nums ${log.type === 'income' ? 'text-blue-600' : 'text-red-500'}`}>
                    {log.amount.toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* [1] 신규 내역 추가 모달 (중앙 정렬 수정) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200 shadow-2xl">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h2 className="font-bold text-gray-700">✍️ 새 내역 기록</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 text-2xl px-2">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={formData.transaction_date} onChange={(e) => setFormData({...formData, transaction_date: e.target.value})} className="p-3 bg-gray-100 rounded-xl text-sm outline-none" />
                <select value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value as any})} className="p-3 bg-gray-100 rounded-xl text-sm outline-none">
                  <option value="expense">지출</option>
                  <option value="income">수입</option>
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
              <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-lg shadow-lg hover:bg-blue-700 transition-all">저장하기</button>
            </form>
          </div>
        </div>
      )}

      {/* [2] 카테고리 관리 모달 (중앙 정렬 유지) */}
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
                    <button onClick={() => handleDeleteCategory(cat.id)} className="text-red-400 font-bold text-xs hover:text-red-600 transition-colors">삭제</button>
                  </div>
                ))}
              </div>
              <div className="bg-blue-50 p-4 rounded-2xl space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" placeholder="코드(영문)" value={newCat.code} onChange={(e) => setNewCat({...newCat, code: e.target.value})} className="w-full p-2.5 rounded-lg text-xs outline-none border-none" />
                  <input type="text" placeholder="이름(한글)" value={newCat.name} onChange={(e) => setNewCat({...newCat, name: e.target.value})} className="w-full p-2.5 rounded-lg text-xs outline-none border-none" />
                </div>
                <button onClick={handleAddCategory} className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-bold text-xs shadow-md">추가</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}