import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import Quagga from 'quagga';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [currentView, setCurrentView] = useState('dispatch');
  const [messengers, setMessengers] = useState([]);
  const [selectedMessenger, setSelectedMessenger] = useState('');
  const [scannedItems, setScannedItems] = useState([]);
  const [todayDispatches, setTodayDispatches] = useState([]);
  const [newMessenger, setNewMessenger] = useState({ name: '', contact_number: '' });
  const [showAddMessenger, setShowAddMessenger] = useState(false);
  const [dailyReport, setDailyReport] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  const [newCard, setNewCard] = useState({ card_number: '', client_name: '' });
  
  const scannerRef = useRef(null);

  useEffect(() => {
    fetchMessengers();
    fetchTodayDispatches();
    fetchDailyReport();
  }, []);

  // Notification system
  const showNotification = (message, type = 'success') => {
    const id = Date.now();
    const notification = { id, message, type };
    setNotifications(prev => [...prev, notification]);
    
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  };

  const fetchMessengers = async () => {
    try {
      const response = await fetch(`${API}/messengers`);
      if (response.ok) {
        const data = await response.json();
        setMessengers(data);
      }
    } catch (error) {
      console.error('Error fetching messengers:', error);
      showNotification('Error al cargar mensajeros', 'error');
    }
  };

  const fetchTodayDispatches = async () => {
    try {
      const response = await fetch(`${API}/dispatches/today`);
      if (response.ok) {
        const data = await response.json();
        setTodayDispatches(data);
      }
    } catch (error) {
      console.error('Error fetching today dispatches:', error);
    }
  };

  const fetchDailyReport = async (date = null) => {
    try {
      const reportDate = date || selectedDate;
      const response = await fetch(`${API}/reports/daily?date=${reportDate}`);
      if (response.ok) {
        const data = await response.json();
        setDailyReport(data);
      }
    } catch (error) {
      console.error('Error fetching daily report:', error);
    }
  };

  const addMessenger = async () => {
    if (!newMessenger.name || !newMessenger.contact_number) {
      showNotification('Complete todos los campos', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API}/messengers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMessenger)
      });

      if (response.ok) {
        setNewMessenger({ name: '', contact_number: '' });
        setShowAddMessenger(false);
        fetchMessengers();
        showNotification('Mensajero agregado exitosamente');
      } else {
        throw new Error('Error al agregar mensajero');
      }
    } catch (error) {
      console.error('Error adding messenger:', error);
      showNotification('Error al agregar mensajero', 'error');
    } finally {
      setLoading(false);
    }
  };

  const deleteMessenger = async (id) => {
    if (window.confirm('¿Está seguro de eliminar este mensajero?')) {
      try {
        const response = await fetch(`${API}/messengers/${id}`, { method: 'DELETE' });
        if (response.ok) {
          fetchMessengers();
          showNotification('Mensajero eliminado exitosamente');
        } else {
          throw new Error('Error al eliminar mensajero');
        }
      } catch (error) {
        console.error('Error deleting messenger:', error);
        showNotification('Error al eliminar mensajero', 'error');
      }
    }
  };

  const manualAddCard = () => {
    setNewCard({ card_number: '', client_name: '' });
    setShowAddCardModal(true);
  };

  const handleAddCard = () => {
    if (!newCard.card_number || !newCard.client_name) {
      showNotification('Complete todos los campos', 'error');
      return;
    }

    const alreadyScanned = scannedItems.find(item => item.card_number === newCard.card_number);
    if (!alreadyScanned) {
      setScannedItems(prev => [...prev, { ...newCard }]);
      showNotification(`Tarjeta agregada:\nNúmero: ${newCard.card_number}\nCliente: ${newCard.client_name}`);
      setShowAddCardModal(false);
      setNewCard({ card_number: '', client_name: '' });
    } else {
      showNotification('Esta tarjeta ya fue agregada', 'error');
    }
  };

  const removeScannedItem = (index) => {
    setScannedItems(prev => prev.filter((_, i) => i !== index));
  };

  const submitDispatch = async () => {
    if (!selectedMessenger || scannedItems.length === 0) {
      showNotification('Seleccione un mensajero y escanee al menos una tarjeta', 'error');
      return;
    }

    setLoading(true);
    try {
      const dispatchData = {
        messenger_id: selectedMessenger,
        items: scannedItems
      };

      const response = await fetch(`${API}/dispatches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dispatchData)
      });

      if (response.ok) {
        setScannedItems([]);
        setSelectedMessenger('');
        fetchTodayDispatches();
        fetchDailyReport();
        showNotification(`Despacho registrado exitosamente!\nTotal de tarjetas: ${scannedItems.length}`);
      } else {
        throw new Error('Error al registrar despacho');
      }
    } catch (error) {
      console.error('Error submitting dispatch:', error);
      showNotification('Error al registrar el despacho', 'error');
    } finally {
      setLoading(false);
    }
  };

  const downloadExcelReport = async () => {
    try {
      const response = await fetch(`${API}/reports/export-excel?date=${selectedDate}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `reporte_despachos_${selectedDate}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        showNotification('Reporte descargado exitosamente');
      } else {
        throw new Error('Error al descargar reporte');
      }
    } catch (error) {
      console.error('Error downloading Excel report:', error);
      showNotification('Error al descargar el reporte', 'error');
    }
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {notifications.map(notification => (
          <div
            key={notification.id}
            className={`px-6 py-3 rounded-lg shadow-lg transform transition-all duration-300 ${
              notification.type === 'error'
                ? 'bg-red-500 text-white'
                : 'bg-green-500 text-white'
            }`}
          >
            {notification.message}
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                🏦 Control de Despachos
              </h1>
              <p className="text-gray-600 mt-1">Sistema de gestión de tarjetas bancarias</p>
            </div>
            <div className="flex items-center space-x-2 bg-blue-50 px-4 py-2 rounded-xl">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-blue-700">Sistema Activo</span>
            </div>
          </div>
          
          {/* Navigation */}
          <nav className="flex space-x-2">
            {[
              { key: 'dispatch', label: '📦 Despachar', icon: '📦' },
              { key: 'messengers', label: '👥 Mensajeros', icon: '👥' },
              { key: 'reports', label: '📊 Reportes', icon: '📊' }
            ].map(nav => (
              <button
                key={nav.key}
                onClick={() => setCurrentView(nav.key)}
                className={`px-6 py-3 rounded-xl font-semibold transition-all duration-200 transform hover:scale-105 ${
                  currentView === nav.key
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                    : 'bg-white/70 text-gray-700 hover:bg-white hover:shadow-md'
                }`}
              >
                {nav.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {currentView === 'dispatch' && (
          <div className="space-y-8">
            {/* Dispatch Form */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-white/50 p-8">
              <div className="flex items-center mb-8">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mr-4">
                  <span className="text-2xl">📦</span>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">Nuevo Despacho</h2>
                  <p className="text-gray-600">Registrar tarjetas para mensajero</p>
                </div>
              </div>
              
              {/* Messenger Selection */}
              <div className="mb-8">
                <label className="block text-sm font-semibold text-gray-700 mb-3">Seleccionar Mensajero</label>
                <select
                  value={selectedMessenger}
                  onChange={(e) => setSelectedMessenger(e.target.value)}
                  className="w-full p-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/80 backdrop-blur-sm"
                >
                  <option value="">-- Seleccione un mensajero --</option>
                  {messengers.map(messenger => (
                    <option key={messenger.id} value={messenger.id}>
                      {messenger.name} - {messenger.contact_number}
                    </option>
                  ))}
                </select>
              </div>

              {/* Add Card Controls */}
              <div className="flex flex-wrap gap-4 mb-8">
                <button
                  onClick={manualAddCard}
                  className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-8 py-4 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 font-semibold flex items-center gap-3 shadow-lg shadow-blue-500/25 transform hover:scale-105"
                >
                  <span className="text-xl">➕</span>
                  Agregar Tarjeta
                </button>
              </div>

              {/* Scanned Items */}
              {scannedItems.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <span className="text-2xl mr-2">📋</span>
                    Tarjetas Escaneadas ({scannedItems.length})
                  </h3>
                  <div className="bg-gray-50/80 backdrop-blur-sm rounded-xl p-6 max-h-80 overflow-y-auto border border-gray-200">
                    <div className="space-y-3">
                      {scannedItems.map((item, index) => (
                        <div key={index} className="bg-white rounded-lg p-4 border border-gray-200 flex justify-between items-center hover:shadow-md transition-shadow">
                          <div className="flex-1">
                            <div className="flex items-center space-x-4">
                              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                <span className="text-sm font-bold text-blue-600">#{index + 1}</span>
                              </div>
                              <div>
                                <div className="font-semibold text-gray-800">Tarjeta: {item.card_number}</div>
                                <div className="text-gray-600 text-sm">Cliente: {item.client_name}</div>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => removeScannedItem(index)}
                            className="text-red-500 hover:text-red-700 transition-colors p-2 rounded-lg hover:bg-red-50"
                          >
                            <span className="text-lg">🗑️</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={submitDispatch}
                disabled={!selectedMessenger || scannedItems.length === 0 || loading}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 px-8 rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-200 font-semibold text-lg shadow-lg shadow-blue-600/25 transform hover:scale-105 disabled:scale-100 flex items-center justify-center gap-3"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Procesando...
                  </>
                ) : (
                  <>
                    <span className="text-xl">✅</span>
                    Registrar Despacho ({scannedItems.length} tarjetas)
                  </>
                )}
              </button>
            </div>

            {/* Today's Dispatches */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-white/50 p-8">
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mr-4">
                  <span className="text-2xl">📅</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800">Despachos de Hoy</h3>
                  <p className="text-gray-600">{todayDispatches.length} despachos registrados</p>
                </div>
              </div>
              
              {todayDispatches.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📭</div>
                  <p className="text-gray-600 text-lg">No hay despachos registrados hoy</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {todayDispatches.map(dispatch => (
                    <div key={dispatch.id} className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start">
                        <div className="flex items-start space-x-4">
                          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                            <span className="text-xl">👤</span>
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-800 text-lg">{dispatch.messenger_name}</h4>
                            <div className="space-y-1 mt-2">
                              <p className="text-sm text-gray-600 flex items-center">
                                <span className="text-sm mr-2">🕒</span>
                                Hora: {formatTime(dispatch.created_at)}
                              </p>
                              <p className="text-sm text-gray-600 flex items-center">
                                <span className="text-sm mr-2">📋</span>
                                Tarjetas: {dispatch.total_cards}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="bg-blue-100 text-blue-800 px-3 py-2 rounded-lg font-semibold">
                          {dispatch.total_cards} tarjetas
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {currentView === 'messengers' && (
          <div className="space-y-8">
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-white/50 p-8">
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mr-4">
                    <span className="text-2xl">👥</span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">Gestión de Mensajeros</h2>
                    <p className="text-gray-600">{messengers.length} mensajeros registrados</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddMessenger(true)}
                  className="bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-3 rounded-xl hover:from-green-600 hover:to-green-700 transition-all duration-200 font-semibold flex items-center gap-2 shadow-lg shadow-green-500/25 transform hover:scale-105"
                >
                  <span className="text-xl">➕</span>
                  Agregar Mensajero
                </button>
              </div>

              {/* Add Messenger Form */}
              {showAddMessenger && (
                <div className="mb-8 bg-gray-50/80 backdrop-blur-sm rounded-xl p-6 border border-gray-200">
                  <div className="flex items-center mb-4">
                    <span className="text-2xl mr-3">👤</span>
                    <h3 className="text-lg font-semibold">Nuevo Mensajero</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <input
                      type="text"
                      placeholder="Nombre completo"
                      value={newMessenger.name}
                      onChange={(e) => setNewMessenger(prev => ({ ...prev, name: e.target.value }))}
                      className="p-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/80"
                    />
                    <input
                      type="text"
                      placeholder="Número de contacto"
                      value={newMessenger.contact_number}
                      onChange={(e) => setNewMessenger(prev => ({ ...prev, contact_number: e.target.value }))}
                      className="p-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/80"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={addMessenger}
                      disabled={loading}
                      className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors font-semibold flex items-center gap-2 disabled:opacity-50"
                    >
                      {loading ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        <span>✅</span>
                      )}
                      Guardar
                    </button>
                    <button
                      onClick={() => {
                        setShowAddMessenger(false);
                        setNewMessenger({ name: '', contact_number: '' });
                      }}
                      className="bg-gray-400 text-white px-6 py-3 rounded-xl hover:bg-gray-500 transition-colors font-semibold flex items-center gap-2"
                    >
                      <span>❌</span>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Messengers List */}
              <div className="grid gap-4">
                {messengers.map(messenger => (
                  <div key={messenger.id} className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                          <span className="text-xl">👤</span>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-800 text-lg">{messenger.name}</h4>
                          <div className="space-y-1 mt-1">
                            <p className="text-gray-600 flex items-center">
                              <span className="text-sm mr-2">📞</span>
                              {messenger.contact_number}
                            </p>
                            <p className="text-xs text-gray-500 flex items-center">
                              <span className="text-xs mr-2">📅</span>
                              Creado: {new Date(messenger.created_at).toLocaleDateString('es-ES')}
                            </p>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteMessenger(messenger.id)}
                        className="text-red-500 hover:text-red-700 transition-colors px-4 py-2 rounded-lg hover:bg-red-50 font-semibold flex items-center gap-2"
                      >
                        <span className="text-lg">🗑️</span>
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {currentView === 'reports' && (
          <div className="space-y-8">
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-white/50 p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mr-4">
                    <span className="text-2xl">📊</span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">Reportes Diarios</h2>
                    <p className="text-gray-600">Análisis y estadísticas de despachos</p>
                  </div>
                </div>
                <button
                  onClick={downloadExcelReport}
                  className="bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-3 rounded-xl hover:from-green-600 hover:to-green-700 transition-all duration-200 font-semibold flex items-center gap-2 shadow-lg shadow-green-500/25 transform hover:scale-105"
                >
                  <span className="text-xl">📥</span>
                  Descargar Excel
                </button>
              </div>
              
              {/* Date Selector */}
              <div className="mb-8">
                <label className="block text-sm font-semibold text-gray-700 mb-3">Seleccionar Fecha</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    fetchDailyReport(e.target.value);
                  }}
                  className="p-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/80 backdrop-blur-sm"
                />
              </div>

              {/* Report Summary */}
              {dailyReport && (
                <div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-6 text-white text-center">
                      <div className="text-3xl font-bold">{dailyReport.total_cards}</div>
                      <div className="text-blue-100 mt-2">Total Tarjetas</div>
                    </div>
                    <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-6 text-white text-center">
                      <div className="text-3xl font-bold">{dailyReport.total_dispatches}</div>
                      <div className="text-green-100 mt-2">Despachos</div>
                    </div>
                    <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl p-6 text-white text-center">
                      <div className="text-3xl font-bold">{dailyReport.total_messengers}</div>
                      <div className="text-purple-100 mt-2">Mensajeros</div>
                    </div>
                    <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl p-6 text-white text-center">
                      <div className="text-3xl font-bold">
                        {dailyReport.total_dispatches > 0 ? Math.round(dailyReport.total_cards / dailyReport.total_dispatches) : 0}
                      </div>
                      <div className="text-orange-100 mt-2">Promedio</div>
                    </div>
                  </div>

                  {/* Detailed Report */}
                  <div className="space-y-6">
                    <h3 className="text-xl font-semibold text-gray-800 flex items-center">
                      <span className="text-2xl mr-3">📋</span>
                      Detalle por Mensajero
                    </h3>
                    {Object.entries(dailyReport.messengers).map(([messengerId, messengerData]) => (
                      <div key={messengerId} className="bg-white rounded-xl p-6 border border-gray-200">
                        <div className="flex justify-between items-center mb-4">
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                              <span className="text-xl">👤</span>
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-800 text-lg">{messengerData.messenger_name}</h4>
                              <p className="text-gray-600 flex items-center">
                                <span className="text-sm mr-2">📞</span>
                                {messengerData.messenger_contact}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-blue-600">{messengerData.total_cards} tarjetas</div>
                            <div className="text-sm text-gray-600">{messengerData.dispatches.length} despachos</div>
                          </div>
                        </div>
                        
                        {/* Individual Dispatches */}
                        <div className="mt-4 space-y-3">
                          {messengerData.dispatches.map((dispatch, index) => (
                            <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center">
                                  <span className="text-lg mr-2">🕒</span>
                                  <span className="font-medium">{formatTime(dispatch.time)}</span>
                                </div>
                                <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-lg text-sm font-semibold">
                                  {dispatch.cards} tarjetas
                                </div>
                              </div>
                              <div className="text-sm text-gray-600">
                                <div className="font-medium mb-1">Tarjetas procesadas:</div>
                                <div className="grid gap-1">
                                  {dispatch.items.map((item, itemIndex) => (
                                    <div key={itemIndex} className="bg-white p-2 rounded border text-xs">
                                      <span className="font-mono">{item.card_number}</span> - {item.client_name}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Add Card Modal */}
      {showAddCardModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mr-4">
                <span className="text-2xl">💳</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800">Agregar Tarjeta</h3>
                <p className="text-gray-600">Ingrese los datos de la tarjeta</p>
              </div>
            </div>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Número de Tarjeta</label>
                <input
                  type="text"
                  placeholder="Ingrese el número de tarjeta"
                  value={newCard.card_number}
                  onChange={(e) => setNewCard(prev => ({ ...prev, card_number: e.target.value }))}
                  className="w-full p-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre del Cliente</label>
                <input
                  type="text"
                  placeholder="Ingrese el nombre del cliente"
                  value={newCard.client_name}
                  onChange={(e) => setNewCard(prev => ({ ...prev, client_name: e.target.value }))}
                  className="w-full p-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                />
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={handleAddCard}
                className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 px-6 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 font-semibold flex items-center justify-center gap-2"
              >
                <span className="text-lg">✅</span>
                Agregar
              </button>
              <button
                onClick={() => {
                  setShowAddCardModal(false);
                  setNewCard({ card_number: '', client_name: '' });
                }}
                className="flex-1 bg-gray-400 text-white py-3 px-6 rounded-xl hover:bg-gray-500 transition-colors font-semibold flex items-center justify-center gap-2"
              >
                <span className="text-lg">❌</span>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;