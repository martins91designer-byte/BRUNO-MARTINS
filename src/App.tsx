import React, { useState, useEffect, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  Trophy, 
  DollarSign, 
  Users, 
  Shuffle, 
  CheckCircle2, 
  LogIn,
  LogOut,
  ChevronRight,
  UserPlus
} from 'lucide-react';
import { supabase } from './lib/supabase';
import { Player, Expense } from './types';

// Auth User type from Supabase
import { User } from '@supabase/supabase-js';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ranking' | 'players' | 'finances' | 'sorter'>('ranking');

  const [showAddModal, setShowAddModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [newExpenseDesc, setNewExpenseDesc] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState<number>(0);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerPaymentType, setNewPlayerPaymentType] = useState<'mensalista' | 'diarista'>('mensalista');
  const [newPlayerStatus, setNewPlayerStatus] = useState<Player['statusFinanceiro']>('em_dia');
  const [newPlayerAmount, setNewPlayerAmount] = useState<number>(0);
  const [numTeams, setNumTeams] = useState(2);
  const [teams, setTeams] = useState<Player[][]>([]);
  const [peladaName, setPeladaName] = useState('Minha Pelada');
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempPeladaName, setTempPeladaName] = useState('');
  const [rankingPeriod, setRankingPeriod] = useState<'weekly' | 'monthly'>('weekly');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsAuthReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthReady || !user) {
      setPlayers([]);
      setLoading(false);
      return;
    }

    const fetchPlayers = async () => {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .order('goals_weekly', { ascending: false });
      
      if (error) {
        console.error('Error fetching players:', error);
      } else {
        // Map snake_case from DB to camelCase for App
        const mappedPlayers = (data || []).map(p => ({
          id: p.id,
          name: p.name,
          goalsWeekly: p.goals_weekly,
          goalsMonthly: p.goals_monthly,
          statusFinanceiro: p.status_financeiro,
          paymentAmount: p.payment_amount,
          paymentType: p.payment_type,
          presente: p.presente,
          createdAt: p.created_at,
          updatedAt: p.updated_at
        })) as Player[];
        setPlayers(mappedPlayers);
      }
      setLoading(false);
    };

    fetchPlayers();

    // Set up real-time subscription
    const channel = supabase
      .channel('players_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => {
        fetchPlayers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthReady, user]);

  useEffect(() => {
    if (!isAuthReady || !user) {
      setExpenses([]);
      return;
    }

    const fetchExpenses = async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('date', { ascending: false });
      
      if (error) {
        console.error('Error fetching expenses:', error);
      } else {
        setExpenses(data || []);
      }
    };

    fetchExpenses();

    const channel = supabase
      .channel('expenses_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => {
        fetchExpenses();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthReady, user]);

  useEffect(() => {
    if (!isAuthReady || !user) return;

    const fetchSettings = async () => {
      const { data, error } = await supabase
        .from('settings')
        .select('pelada_name')
        .eq('id', 'global')
        .single();
      
      if (error) {
        if (error.code === 'PGRST116' && user.email === 'martins91designer@gmail.com') {
          // Initial setup
          await supabase.from('settings').insert({ id: 'global', pelada_name: 'Artilheiro FC' });
          setPeladaName('Artilheiro FC');
        } else {
          console.error('Error fetching settings:', error);
        }
      } else {
        setPeladaName(data.pelada_name);
      }
    };

    fetchSettings();

    const channel = supabase
      .channel('settings_channel')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'settings', filter: 'id=eq.global' }, (payload) => {
        setPeladaName((payload.new as any).pelada_name);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthReady, user]);

  const loginWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) console.error('Error logging in:', error);
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Error logging out:', error);
  };

  const savePeladaName = async () => {
    if (!tempPeladaName.trim()) return;
    try {
      const { error } = await supabase
        .from('settings')
        .update({ pelada_name: tempPeladaName.trim() })
        .eq('id', 'global');
      if (error) throw error;
      setIsEditingName(false);
    } catch (error) {
      console.error('Error saving pelada name:', error);
    }
  };

  const addPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;

    try {
      const { error } = await supabase
        .from('players')
        .insert({
          name: newPlayerName.trim(),
          goals_weekly: 0,
          goals_monthly: 0,
          status_financeiro: newPlayerStatus,
          payment_type: newPlayerPaymentType,
          payment_amount: newPlayerAmount,
          presente: false
        });
      if (error) throw error;
      setNewPlayerName('');
      setNewPlayerAmount(0);
      setNewPlayerStatus('em_dia');
      setShowAddModal(false);
    } catch (error) {
      console.error('Error adding player:', error);
    }
  };

  const togglePresence = async (player: Player) => {
    try {
      const { error } = await supabase
        .from('players')
        .update({ presente: !player.presente })
        .eq('id', player.id);
      if (error) throw error;
    } catch (error) {
      console.error('Error toggling presence:', error);
    }
  };

  const updateGoals = async (player: Player, increment: number) => {
    try {
      const { error } = await supabase
        .from('players')
        .update({
          goals_weekly: Math.max(0, player.goalsWeekly + increment),
          goals_monthly: Math.max(0, player.goalsMonthly + increment)
        })
        .eq('id', player.id);
      if (error) throw error;
    } catch (error) {
      console.error('Error updating goals:', error);
    }
  };

  const toggleFinance = async (player: Player) => {
    try {
      const statuses: Player['statusFinanceiro'][] = ['em_dia', 'devendo', 'isento'];
      const currentIndex = statuses.indexOf(player.statusFinanceiro);
      const nextStatus = statuses[(currentIndex + 1) % statuses.length];

      const { error } = await supabase
        .from('players')
        .update({ status_financeiro: nextStatus })
        .eq('id', player.id);
      if (error) throw error;
    } catch (error) {
      console.error('Error toggling finance:', error);
    }
  };

  const addExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpenseDesc.trim() || newExpenseAmount <= 0) return;

    try {
      const { error } = await supabase
        .from('expenses')
        .insert({
          description: newExpenseDesc.trim(),
          amount: newExpenseAmount,
          date: new Date().toISOString()
        });
      if (error) throw error;
      setNewExpenseDesc('');
      setNewExpenseAmount(0);
      setShowExpenseModal(false);
    } catch (error) {
      console.error('Error adding expense:', error);
    }
  };

  const deleteExpense = async (id: string) => {
    if (!window.confirm('Excluir esta despesa?')) return;
    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.error('Error deleting expense:', error);
    }
  };

  const deletePlayer = async (id: string) => {
    if (!window.confirm('Excluir atleta?')) return;
    try {
      const { error } = await supabase
        .from('players')
        .delete()
        .eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.error('Error deleting player:', error);
    }
  };

  const updatePaymentInfo = async (player: Player, field: 'paymentAmount' | 'paymentType', value: any) => {
    try {
      const dbField = field === 'paymentAmount' ? 'payment_amount' : 'payment_type';
      const { error } = await supabase
        .from('players')
        .update({ [dbField]: value })
        .eq('id', player.id);
      if (error) throw error;
    } catch (error) {
      console.error('Error updating payment info:', error);
    }
  };

  const shuffleTeams = () => {
    const presentPlayers = players.filter(p => p.presente);
    if (presentPlayers.length < numTeams) {
      alert(`Necessário pelo menos ${numTeams} atletas presentes.`);
      return;
    }

    const shuffled = [...presentPlayers].sort(() => Math.random() - 0.5);
    const newTeams: Player[][] = Array.from({ length: numTeams }, () => []);

    shuffled.forEach((player, index) => {
      newTeams[index % numTeams].push(player);
    });

    setTeams(newTeams);
  };

  const isAdmin = user?.email === 'martins91designer@gmail.com';

  const stats = useMemo(() => ({
    presentes: players.filter(p => p.presente).length,
    emDia: players.filter(p => p.statusFinanceiro === 'em_dia').length,
    devendo: players.filter(p => p.statusFinanceiro === 'devendo').length,
    isento: players.filter(p => p.statusFinanceiro === 'isento').length,
    totalArrecadado: players.filter(p => p.statusFinanceiro === 'em_dia').reduce((acc, p) => acc + (p.paymentAmount || 0), 0),
    totalPendente: players.filter(p => p.statusFinanceiro === 'devendo').reduce((acc, p) => acc + (p.paymentAmount || 0), 0),
    totalDespesas: expenses.reduce((acc, exp) => acc + (exp.amount || 0), 0)
  }), [players, expenses]);

  const balanceData = useMemo(() => [
    { name: 'Receita', value: stats.totalArrecadado, color: '#2ecc71' },
    { name: 'Despesas', value: stats.totalDespesas, color: '#e74c3c' }
  ], [stats]);

  const chartData = useMemo(() => [
    { name: 'Em Dia', value: stats.emDia, color: '#2ecc71' },
    { name: 'Devedores', value: stats.devendo, color: '#e74c3c' },
    { name: 'Isentos', value: stats.isento, color: '#95a5a6' }
  ], [stats]);

  if (!isAuthReady) return <div className="min-h-screen flex items-center justify-center bg-gray-bg font-sans">Carregando...</div>;

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-bg font-sans">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-md w-full bg-white p-10 rounded-2xl shadow-xl border border-gray-border">
          <img 
            src="https://raw.githubusercontent.com/martins91designer/Artilheiro/main/logo.png" 
            alt="Artilheiro Logo" 
            className="w-full max-w-[280px] mx-auto mb-8 drop-shadow-md"
            onError={(e) => {
              // Fallback to stylized text if image doesn't load
              e.currentTarget.style.display = 'none';
              const fallback = document.getElementById('logo-fallback');
              if (fallback) fallback.classList.remove('hidden');
            }}
          />
          <div id="logo-fallback" className="hidden mb-6">
            <div className="w-16 h-16 bg-green-primary text-white rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">⚽</div>
            <h1 className="text-3xl font-extrabold text-green-primary mb-2 tracking-tight uppercase leading-tight">
              {peladaName}
            </h1>
          </div>
          <p className="text-text-muted mb-10 font-medium">Gestão profissional para os craques da pelada.</p>
          <button onClick={loginWithGoogle} className="flex items-center justify-center gap-3 w-full py-4 bg-green-primary text-white rounded-lg shadow-md hover:bg-green-700 transition-all font-bold active:scale-95 text-lg">
            <LogIn className="w-6 h-6" /> Entrar com Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-bg font-sans">
      {/* Sleek Header */}
      <header className="h-[70px] bg-green-primary text-white shadow-lg flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-white text-green-primary w-8 h-8 rounded-full flex items-center justify-center font-bold text-lg">⚽</div>
          {isEditingName && isAdmin ? (
            <div className="flex items-center gap-2">
              <input 
                autoFocus
                value={tempPeladaName}
                onChange={(e) => setTempPeladaName(e.target.value)}
                onBlur={savePeladaName}
                onKeyDown={(e) => e.key === 'Enter' && savePeladaName()}
                className="bg-green-700 text-white border-none outline-none px-2 py-1 rounded font-bold text-sm"
              />
            </div>
          ) : (
            <h1 
              onClick={() => {
                if (isAdmin) {
                  setIsEditingName(true);
                  setTempPeladaName(peladaName);
                }
              }}
              className={`text-xl font-extrabold tracking-widest ${isAdmin ? 'cursor-pointer hover:opacity-80' : ''}`}
            >
              {peladaName.toUpperCase()}
            </h1>
          )}
        </div>
        <div className="hidden lg:block text-sm opacity-80 font-medium">Controle de Pelada • Arena Central</div>
        <button onClick={logout} className="p-2 opacity-80 hover:opacity-100 transition-opacity"><LogOut className="w-6 h-6" /></button>
      </header>

      {/* Main Grid Content */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_1fr] xl:grid-cols-[350px_1fr_300px] gap-6 p-6 max-w-[1600px] mx-auto w-full overflow-y-auto lg:overflow-visible">
        
        {/* Left Column: Athletes & Summary */}
        <div className="flex flex-col gap-6">
          <section className="sleek-card min-h-[400px]">
            <div className="sleek-card-header">
              <span>Atletas Ativos</span>
              {isAdmin && (
                <button 
                  onClick={() => setShowAddModal(true)}
                  className="text-xs text-green-primary font-bold hover:underline"
                >
                  + Cadastrar
                </button>
              )}
            </div>
            <div className="p-5 flex-1 flex flex-col gap-5 overflow-hidden">
              <div className="grid grid-cols-3 gap-2">
                <StatBox label="Presentes" value={stats.presentes} />
                <StatBox label="Arrecadado" value={`R$ ${stats.totalArrecadado}`} />
                <StatBox label="Pendente" value={`R$ ${stats.totalPendente}`} isDanger />
              </div>

              <div className="flex-1 overflow-y-auto pr-1 no-scrollbar">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-gray-border">
                      <th className="text-left py-3 text-text-muted font-bold text-xs uppercase tracking-wider">Nome</th>
                      <th className="text-right py-3 text-text-muted font-bold text-xs uppercase tracking-wider">Pres.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {players.map(player => (
                      <tr key={player.id} className="group">
                        <td className="py-4 font-semibold text-text-main flex items-center justify-between pr-2">
                          {player.name}
                          {isAdmin && (
                            <button onClick={() => deletePlayer(player.id)} className="opacity-0 group-hover:opacity-100 p-1 text-red-300 hover:text-red-500 transition-all">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                        <td className="py-4 text-right">
                          <input 
                            type="checkbox" 
                            checked={player.presente}
                            disabled={!isAdmin}
                            onChange={() => togglePresence(player)}
                            className="w-4 h-4 accent-green-primary rounded cursor-pointer"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {players.length === 0 && <EmptyState message="Sem atletas" compact />}
              </div>
            </div>
          </section>

          {/* New Financial Summary Section */}
          <section className="sleek-card">
            <div className="sleek-card-header">Balanço: Receita vs Despesas</div>
            <div className="p-5 h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={balanceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={60}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {balanceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="px-5 pb-5 text-center">
              <div className="text-xs font-bold text-text-muted uppercase">Saldo em Caixa</div>
              <div className={`text-xl font-black ${stats.totalArrecadado - stats.totalDespesas >= 0 ? 'text-green-primary' : 'text-danger'}`}>
                R$ {stats.totalArrecadado - stats.totalDespesas}
              </div>
            </div>
          </section>

          <section className="sleek-card">
            <div className="sleek-card-header">Atletas (Status)</div>
            <div className="p-5 h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={60}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        {/* Center/Middle Column: Financial Table & Ranking */}
        <div className="flex flex-col gap-6">
          <section className="sleek-card h-fit">
            <div className="sleek-card-header flex justify-between items-center">
              <span>Despesas Detalhadas</span>
              {isAdmin && (
                <button 
                  onClick={() => setShowExpenseModal(true)}
                  className="text-xs text-danger font-bold hover:underline"
                >
                  + Nova Despesa
                </button>
              )}
            </div>
            <div className="p-5 overflow-x-auto min-h-[200px]">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-border">
                    <th className="py-3 px-2 font-bold text-text-muted uppercase tracking-wider">Descrição</th>
                    <th className="py-3 px-2 font-bold text-text-muted uppercase tracking-wider">Valor</th>
                    <th className="py-3 px-2 font-bold text-text-muted uppercase tracking-wider text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {expenses.map(exp => (
                    <tr key={exp.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 px-2 font-medium text-text-main">{exp.description}</td>
                      <td className="py-3 px-2 font-bold text-danger leading-none">R$ {exp.amount}</td>
                      <td className="py-3 px-2 text-right">
                        {isAdmin && (
                          <button onClick={() => deleteExpense(exp.id)} className="text-red-300 hover:text-red-500 transition-colors">
                            <Trash2 className="w-4 h-4 ml-auto" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {expenses.length === 0 && <EmptyState message="Nenhuma despesa" compact />}
            </div>
          </section>

          <section className="sleek-card h-fit">
            <div className="sleek-card-header">Controle de Mensalidades</div>
            <div className="p-5 overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-border">
                    <th className="py-3 px-2 font-bold text-text-muted uppercase">Nome</th>
                    <th className="py-3 px-2 font-bold text-text-muted uppercase">Tipo</th>
                    <th className="py-3 px-2 font-bold text-text-muted uppercase">Valor</th>
                    <th className="py-3 px-2 font-bold text-text-muted uppercase text-right">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {players.map(player => (
                    <tr key={player.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 px-2 font-bold text-text-main">{player.name}</td>
                      <td className="py-3 px-2">
                        {isAdmin ? (
                          <select 
                            value={player.paymentType}
                            onChange={(e) => updatePaymentInfo(player, 'paymentType', e.target.value)}
                            className="bg-transparent font-medium text-text-muted outline-none"
                          >
                            <option value="mensalista">Mensalista</option>
                            <option value="diarista">Diarista</option>
                            <option value="isento">Isento</option>
                          </select>
                        ) : (
                          <span className="capitalize">{player.paymentType}</span>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        {isAdmin ? (
                          <div className="flex items-center gap-1">
                            <span className="text-text-muted">R$</span>
                            <input 
                              type="number" 
                              value={player.paymentAmount} 
                              onChange={(e) => updatePaymentInfo(player, 'paymentAmount', Number(e.target.value))}
                              className="w-12 bg-transparent font-medium text-green-primary outline-none border-b border-transparent focus:border-green-primary"
                            />
                          </div>
                        ) : (
                          <span className="font-bold text-green-primary">R$ {player.paymentAmount}</span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <button 
                          disabled={!isAdmin}
                          onClick={() => toggleFinance(player)}
                          className={`sleek-status-pill ${
                            player.statusFinanceiro === 'em_dia' 
                              ? 'bg-emerald-50 text-green-primary' 
                              : player.statusFinanceiro === 'devendo'
                              ? 'bg-red-50 text-danger'
                              : 'bg-gray-100 text-text-muted'
                          }`}
                        >
                          {player.statusFinanceiro === 'em_dia' ? 'Pago' : player.statusFinanceiro === 'devendo' ? 'Pendente' : 'Isento'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="sleek-card">
            <div className="sleek-card-header flex justify-between items-center">
            <span>Ranking de Artilheiros</span>
            <div className="flex bg-gray-bg rounded-lg p-0.5 border border-gray-border">
              <button 
                onClick={() => setRankingPeriod('weekly')}
                className={`text-[10px] px-2 py-1 rounded-md font-bold transition-all ${rankingPeriod === 'weekly' ? 'bg-white text-green-primary shadow-sm' : 'text-text-muted hover:text-text-main'}`}
              >
                Semanal
              </button>
              <button 
                onClick={() => setRankingPeriod('monthly')}
                className={`text-[10px] px-2 py-1 rounded-md font-bold transition-all ${rankingPeriod === 'monthly' ? 'bg-white text-green-primary shadow-sm' : 'text-text-muted hover:text-text-main'}`}
              >
                Mensal
              </button>
            </div>
          </div>
          <div className="p-5 flex-1 overflow-y-auto no-scrollbar">
            {players.length === 0 ? (
              <EmptyState message="Nenhum gol registrado." />
            ) : (
              <div className="space-y-1">
                {players
                  .sort((a, b) => (rankingPeriod === 'weekly' ? b.goalsWeekly - a.goalsWeekly : b.goalsMonthly - a.goalsMonthly))
                  .map((player, idx) => {
                    const goals = rankingPeriod === 'weekly' ? player.goalsWeekly : player.goalsMonthly;
                    const isTop3 = idx < 3;
                    const top3Icons = ['🥇', '🥈', '🥉'];
                    
                    return (
                      <div key={player.id} className={`flex items-center gap-4 py-4 border-b border-gray-50 ${idx === 0 ? 'bg-amber-50/30 rounded-lg px-2' : ''}`}>
                        <div className="w-8 font-bold text-green-primary text-center">
                          {idx === 0 ? <span className="text-amber-500">👑</span> : `${idx + 1}º`}
                        </div>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 relative ${idx === 0 ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-400'}`}>
                          <Users className="w-5 h-5" />
                          {rankingPeriod === 'monthly' && isTop3 && (
                            <span className="absolute -top-1 -right-1 text-[14px]">{top3Icons[idx]}</span>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="font-bold text-text-main leading-tight">{player.name}</div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          {isAdmin && (
                            <div className="flex gap-1">
                              <button onClick={() => updateGoals(player, -1)} className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center font-bold hover:bg-gray-200">-</button>
                              <button onClick={() => updateGoals(player, 1)} className="w-8 h-8 rounded-lg bg-green-primary text-white flex items-center justify-center font-bold hover:bg-green-700 shadow-sm">+</button>
                            </div>
                          )}
                          <div className={`bg-green-primary text-white px-3 py-1 rounded-full font-extrabold text-sm min-w-[36px] text-center ${rankingPeriod === 'monthly' && idx === 0 ? 'bg-amber-500 animate-pulse' : ''}`}>
                            {goals}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Right Column: Sorter */}
      <section className="sleek-card h-full">
          <div className="sleek-card-header">Sorteio de Times</div>
          <div className="p-5 flex-1 flex flex-col overflow-hidden">
            <p className="text-xs text-text-muted mb-6">
              Sorteio baseado nos {stats.presentes} atletas marcados como presentes.
            </p>

            <div className="flex-1 overflow-y-auto space-y-4 no-scrollbar pr-1">
              {teams.length === 0 ? (
                <div className="border-2 border-dashed border-gray-border rounded-lg p-10 flex flex-col items-center justify-center gap-3 text-text-muted text-center italic">
                  <Shuffle className="w-8 h-8 opacity-20" />
                  Equipes pendentes
                </div>
              ) : (
                teams.map((team, idx) => (
                  <div key={idx} className="border-2 border-dashed border-gray-border rounded-xl p-4">
                    <div className={`text-[11px] font-bold uppercase mb-3 ${idx % 2 === 0 ? 'text-blue-500' : 'text-green-primary'}`}>
                      {idx % 2 === 0 ? 'Time Branco' : 'Time Verde'}
                    </div>
                    <ul className="text-sm text-text-main space-y-1">
                      {team.map(p => (
                        <li key={p.id}>{p.name}</li>
                      ))}
                    </ul>
                  </div>
                )))}
            </div>

            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-center gap-4 text-xs font-bold text-text-muted">
                <span>EQUIPES:</span>
                <input 
                  type="number" 
                  min="2" 
                  value={numTeams} 
                  onChange={(e) => setNumTeams(Number(e.target.value))}
                  className="w-12 bg-gray-bg border border-gray-border rounded p-1 text-center text-green-primary outline-none"
                />
              </div>
              <button 
                onClick={shuffleTeams}
                className="w-full bg-green-primary text-white font-bold py-3 rounded-lg shadow-md hover:bg-green-700 active:scale-[0.98] transition-all"
              >
                SORTEAR NOVAMENTE
              </button>
              <p className="text-[10px] text-center text-text-muted mt-2">Critério: Equilíbrio Técnico</p>
            </div>
          </div>
        </section>
      </main>

      {/* Add Player Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-green-primary/30 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl border border-gray-border">
            <h3 className="text-xl font-extrabold mb-8 flex items-center gap-2 text-green-primary uppercase tracking-tight">
              <UserPlus className="w-6 h-6" /> Novo Atleta
            </h3>
            <form onSubmit={addPlayer} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Nome Completo</label>
                <input autoFocus required type="text" value={newPlayerName} onChange={(e) => setNewPlayerName(e.target.value)} className="w-full p-3 bg-gray-bg border border-gray-border rounded-xl outline-none font-semibold text-text-main focus:border-green-primary transition-all" placeholder="Ex: Lucas Canhão"/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Tipo</label>
                  <select value={newPlayerPaymentType} onChange={(e) => setNewPlayerPaymentType(e.target.value as any)} className="w-full p-3 bg-gray-bg border border-gray-border rounded-xl outline-none font-semibold text-text-main focus:border-green-primary transition-all">
                    <option value="mensalista">Mensalista</option>
                    <option value="diarista">Diarista</option>
                    <option value="isento">Isento</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Valor (R$)</label>
                  <input type="number" value={newPlayerAmount} onChange={(e) => setNewPlayerAmount(Number(e.target.value))} className="w-full p-3 bg-gray-bg border border-gray-border rounded-xl outline-none font-semibold text-text-main focus:border-green-primary transition-all" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Situação</label>
                  <select value={newPlayerStatus} onChange={(e) => setNewPlayerStatus(e.target.value as Player['statusFinanceiro'])} className="w-full p-3 bg-gray-bg border border-gray-border rounded-xl outline-none font-semibold text-text-main focus:border-green-primary transition-all">
                    <option value="em_dia">Em Dia (Pago)</option>
                    <option value="devendo">Pendente</option>
                    <option value="isento">Isento</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 text-text-muted font-bold hover:bg-gray-50 rounded-lg transition-all">Cancelar</button>
                <button type="submit" className="flex-1 py-3 bg-green-primary text-white font-bold rounded-lg shadow-lg hover:bg-green-700 active:scale-95 transition-all">Salvar</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Add Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-red-primary/30 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl border border-gray-border">
            <h3 className="text-xl font-extrabold mb-8 flex items-center gap-2 text-danger uppercase tracking-tight">
              <DollarSign className="w-6 h-6" /> Nova Despesa
            </h3>
            <form onSubmit={addExpense} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Descrição</label>
                <input autoFocus required type="text" value={newExpenseDesc} onChange={(e) => setNewExpenseDesc(e.target.value)} className="w-full p-3 bg-gray-bg border border-gray-border rounded-xl outline-none font-semibold text-text-main focus:border-danger transition-all" placeholder="Ex: Bola Nova, Arbitragem"/>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Valor (R$)</label>
                <input required type="number" step="0.01" value={newExpenseAmount} onChange={(e) => setNewExpenseAmount(Number(e.target.value))} className="w-full p-3 bg-gray-bg border border-gray-border rounded-xl outline-none font-semibold text-text-main focus:border-danger transition-all" />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowExpenseModal(false)} className="flex-1 py-3 text-text-muted font-bold hover:bg-gray-50 rounded-lg transition-all">Cancelar</button>
                <button type="submit" className="flex-1 py-3 bg-danger text-white font-bold rounded-lg shadow-lg hover:bg-red-700 active:scale-95 transition-all">Salvar</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

  const StatBox = ({ label, value, isDanger }: { label: string, value: string | number, isDanger?: boolean }) => {
  return (
    <div className="bg-gray-bg p-3 rounded-lg text-center border border-gray-border/50">
      <div className="text-[9px] font-bold text-text-muted uppercase tracking-widest">{label}</div>
      <div className={`text-sm xl:text-lg font-extrabold truncate ${isDanger ? 'text-danger' : 'text-green-primary'}`}>{value}</div>
    </div>
  );
}

function EmptyState({ message, compact }: { message: string, compact?: boolean }) {
  return (
    <div className={`text-center px-6 border-2 border-dashed border-gray-border rounded-xl flex flex-col items-center justify-center text-text-muted ${compact ? 'py-10 text-xs' : 'py-24'}`}>
      <Users className="w-10 opacity-10 mb-2" />
      <p className="font-semibold">{message}</p>
    </div>
  );
}

