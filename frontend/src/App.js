import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Quagga from 'quagga';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [currentView, setCurrentView] = useState('dispatch'); // 'dispatch', 'messengers', 'reports'
  const [messengers, setMessengers] = useState([]);
  const [selectedMessenger, setSelectedMessenger] = useState('');
  const [scannedItems, setScannedItems] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [todayDispatches, setTodayDispatches] = useState([]);
  const [newMessenger, setNewMessenger] = useState({ name: '', contact_number: '' });
  const [showAddMessenger, setShowAddMessenger] = useState(false);
  const scannerRef = useRef(null);
  const [dailyReport, setDailyReport] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchMessengers();
    fetchTodayDispatches();
    fetchDailyReport();
  }, []);

  const fetchMessengers = async () => {
    try {
      const response = await axios.get(`${API}/messengers`);
      setMessengers(response.data);
    } catch (error) {
      console.error('Error fetching messengers:', error);
      alert('Error al cargar mensajeros');
    }
  };

  const fetchTodayDispatches = async () => {
    try {
      const response = await axios.get(`${API}/dispatches/today`);
      setTodayDispatches(response.data);
    } catch (error) {
      console.error('Error fetching today dispatches:', error);
    }
  };

  const fetchDailyReport = async (date = null) => {
    try {
      const reportDate = date || selectedDate;
      const response = await axios.get(`${API}/reports/daily?date=${reportDate}`);
      setDailyReport(response.data);
    } catch (error) {
      console.error('Error fetching daily report:', error);
    }
  };

  const addMessenger = async () => {
    if (!newMessenger.name || !newMessenger.contact_number) {
      alert('Complete todos los campos');
      return;
    }

    try {
      await axios.post(`${API}/messengers`, newMessenger);
      setNewMessenger({ name: '', contact_number: '' });
      setShowAddMessenger(false);
      fetchMessengers();
      alert('Mensajero agregado exitosamente');
    } catch (error) {
      console.error('Error adding messenger:', error);
      alert('Error al agregar mensajero');
    }
  };

  const deleteMessenger = async (id) => {
    if (window.confirm('¿Está seguro de eliminar este mensajero?')) {
      try {
        await axios.delete(`${API}/messengers/${id}`);
        fetchMessengers();
        alert('Mensajero eliminado');
      } catch (error) {
        console.error('Error deleting messenger:', error);
        alert('Error al eliminar mensajero');
      }
    }
  };

  const startScanning = () => {
    if (!selectedMessenger) {
      alert('Seleccione un mensajero primero');
      return;
    }

    setIsScanning(true);
    
    // Initialize Quagga
    setTimeout(() => {
      Quagga.init({
        inputStream: {
          name: "Live",
          type: "LiveStream",
          target: scannerRef.current,
          constraints: {
            width: 640,
            height: 480,
            facingMode: "environment"
          }
        },
        locator: {
          patchSize: "medium",
          halfSample: true
        },
        numOfWorkers: 2,
        decoder: {
          readers: ["code_128_reader", "ean_reader", "ean_8_reader", "code_39_reader"]
        },
        locate: true
      }, function(err) {
        if (err) {
          console.error('QuaggaJS failed to initialize:', err);
          alert('Error al inicializar el escáner. Verifique los permisos de cámara.');
          setIsScanning(false);
          return;
        }
        Quagga.start();
      });

      // Listen for successful scans
      Quagga.onDetected((result) => {
        const code = result.codeResult.code;
        processScannedCode(code);
      });
    }, 100);
  };

  const stopScanning = () => {
    Quagga.stop();
    setIsScanning(false);
  };

  const processScannedCode = (code) => {
    // Parse the scanned code to extract card number and client number
    // Assuming the format is: CARDNUMBER|CLIENTNUMBER or similar
    let cardNumber, clientNumber;
    
    if (code.includes('|')) {
      [cardNumber, clientNumber] = code.split('|');
    } else if (code.includes('-')) {
      [cardNumber, clientNumber] = code.split('-');
    } else {
      // If no separator, use the whole code as card number and prompt for client
      cardNumber = code;
      clientNumber = prompt('Ingrese el número del cliente:');
    }

    if (cardNumber && clientNumber) {
      // Check if already scanned
      const alreadyScanned = scannedItems.find(item => item.card_number === cardNumber);
      if (!alreadyScanned) {
        const newItem = { card_number: cardNumber, client_number: clientNumber };
        setScannedItems(prev => [...prev, newItem]);
        
        // Visual feedback
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEcBzuq3/PHfS0FKXnU8N2NRQ4ZaLvz6KNREAx/kOLtvmUiCjeP0fPRhzAEHny98OOPQAwXX7nn7qVUBj1/lODxummNLwgZaLnq4qNNBjxnq+LXgCkELHXJ8N6QQAtVo+H0vmlhFgdMm9r5wms0DEe/xd6lUBYGPXi48NyOPgcPX7ns4qBLBA0qL5c0j');
        audio.play().catch(() => {});
        
        alert(`Tarjeta escaneada:\nNúmero: ${cardNumber}\nCliente: ${clientNumber}`);
      } else {
        alert('Esta tarjeta ya fue escaneada');
      }
    }
  };

  const manualAddCard = () => {
    const cardNumber = prompt('Número de tarjeta:');
    const clientNumber = prompt('Número de cliente:');
    
    if (cardNumber && clientNumber) {
      const alreadyScanned = scannedItems.find(item => item.card_number === cardNumber);
      if (!alreadyScanned) {
        setScannedItems(prev => [...prev, { card_number: cardNumber, client_number: clientNumber }]);
      } else {
        alert('Esta tarjeta ya fue agregada');
      }
    }
  };

  const removeScannedItem = (index) => {
    setScannedItems(prev => prev.filter((_, i) => i !== index));
  };

  const submitDispatch = async () => {
    if (!selectedMessenger || scannedItems.length === 0) {
      alert('Seleccione un mensajero y escanee al menos una tarjeta');
      return;
    }

    try {
      const dispatchData = {
        messenger_id: selectedMessenger,
        items: scannedItems
      };

      await axios.post(`${API}/dispatches`, dispatchData);
      
      // Reset form
      setScannedItems([]);
      setSelectedMessenger('');
      
      // Refresh data
      fetchTodayDispatches();
      fetchDailyReport();
      
      alert(`Despacho registrado exitosamente!\nTotal de tarjetas: ${scannedItems.length}`);
    } catch (error) {
      console.error('Error submitting dispatch:', error);
      alert('Error al registrar el despacho');
    }
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">📋 Control de Despachos de Tarjetas</h1>
          
          {/* Navigation */}
          <nav className="flex space-x-1">
            {[
              { key: 'dispatch', label: '📦 Despachar', icon: '📦' },
              { key: 'messengers', label: '👥 Mensajeros', icon: '👥' },
              { key: 'reports', label: '📊 Reportes', icon: '📊' }
            ].map(nav => (
              <button
                key={nav.key}
                onClick={() => setCurrentView(nav.key)}
                className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                  currentView === nav.key
                    ? 'bg-blue-600 text-white shadow-md transform scale-105'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:scale-105'
                }`}
              >
                {nav.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {currentView === 'dispatch' && (
          <div className="space-y-6">
            {/* Dispatch Form */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">📦 Nuevo Despacho</h2>
              
              {/* Messenger Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Seleccionar Mensajero</label>
                <select
                  value={selectedMessenger}
                  onChange={(e) => setSelectedMessenger(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">-- Seleccione un mensajero --</option>
                  {messengers.map(messenger => (
                    <option key={messenger.id} value={messenger.id}>
                      {messenger.name} - {messenger.contact_number}
                    </option>
                  ))}
                </select>
              </div>

              {/* Scanner Controls */}
              <div className="flex flex-wrap gap-4 mb-6">
                {!isScanning ? (
                  <button
                    onClick={startScanning}
                    className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-2"
                  >
                    📷 Iniciar Escáner
                  </button>
                ) : (
                  <button
                    onClick={stopScanning}
                    className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center gap-2"
                  >
                    ⏹️ Detener Escáner
                  </button>
                )}
                
                <button
                  onClick={manualAddCard}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
                >
                  ➕ Agregar Manual
                </button>
              </div>

              {/* Scanner */}
              {isScanning && (
                <div className="mb-6">
                  <div className="bg-gray-800 rounded-lg p-4">
                    <div ref={scannerRef} className="w-full max-w-md mx-auto rounded-lg overflow-hidden" />
                  </div>
                  <p className="text-sm text-gray-600 mt-2 text-center">
                    Apunte la cámara hacia el código de barras de la tarjeta
                  </p>
                </div>
              )}

              {/* Scanned Items */}
              {scannedItems.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">
                    Tarjetas Escaneadas ({scannedItems.length})
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
                    {scannedItems.map((item, index) => (
                      <div key={index} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-b-0">
                        <div>
                          <span className="font-medium">Tarjeta: {item.card_number}</span>
                          <span className="text-gray-600 ml-4">Cliente: {item.client_number}</span>
                        </div>
                        <button
                          onClick={() => removeScannedItem(index)}
                          className="text-red-600 hover:text-red-800 transition-colors"
                        >
                          ❌
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={submitDispatch}
                disabled={!selectedMessenger || scannedItems.length === 0}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
              >
                ✅ Registrar Despacho ({scannedItems.length} tarjetas)
              </button>
            </div>

            {/* Today's Dispatches */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">📅 Despachos de Hoy</h3>
              {todayDispatches.length === 0 ? (
                <p className="text-gray-600">No hay despachos registrados hoy</p>
              ) : (
                <div className="space-y-3">
                  {todayDispatches.map(dispatch => (
                    <div key={dispatch.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold text-gray-800">{dispatch.messenger_name}</h4>
                          <p className="text-sm text-gray-600">Hora: {formatTime(dispatch.created_at)}</p>
                          <p className="text-sm text-gray-600">Tarjetas: {dispatch.total_cards}</p>
                        </div>
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-medium">
                          {dispatch.total_cards} tarjetas
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {currentView === 'messengers' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">👥 Gestión de Mensajeros</h2>
                <button
                  onClick={() => setShowAddMessenger(true)}
                  className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  ➕ Agregar Mensajero
                </button>
              </div>

              {/* Add Messenger Form */}
              {showAddMessenger && (
                <div className="mb-6 bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-4">Nuevo Mensajero</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <input
                      type="text"
                      placeholder="Nombre completo"
                      value={newMessenger.name}
                      onChange={(e) => setNewMessenger(prev => ({ ...prev, name: e.target.value }))}
                      className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="Número de contacto"
                      value={newMessenger.contact_number}
                      onChange={(e) => setNewMessenger(prev => ({ ...prev, contact_number: e.target.value }))}
                      className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={addMessenger}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      ✅ Guardar
                    </button>
                    <button
                      onClick={() => {
                        setShowAddMessenger(false);
                        setNewMessenger({ name: '', contact_number: '' });
                      }}
                      className="bg-gray-400 text-white px-4 py-2 rounded-lg hover:bg-gray-500 transition-colors"
                    >
                      ❌ Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Messengers List */}
              <div className="space-y-3">
                {messengers.map(messenger => (
                  <div key={messenger.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-semibold text-gray-800">{messenger.name}</h4>
                        <p className="text-sm text-gray-600">📞 {messenger.contact_number}</p>
                        <p className="text-xs text-gray-500">
                          Creado: {new Date(messenger.created_at).toLocaleDateString('es-ES')}
                        </p>
                      </div>
                      <button
                        onClick={() => deleteMessenger(messenger.id)}
                        className="text-red-600 hover:text-red-800 transition-colors px-3 py-1 rounded hover:bg-red-50"
                      >
                        🗑️ Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {currentView === 'reports' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">📊 Reportes Diarios</h2>
              
              {/* Date Selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Seleccionar Fecha</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    fetchDailyReport(e.target.value);
                  }}
                  className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Report Summary */}
              {dailyReport && (
                <div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-blue-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-blue-600">{dailyReport.total_cards}</div>
                      <div className="text-sm text-gray-600">Total Tarjetas</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-green-600">{dailyReport.total_dispatches}</div>
                      <div className="text-sm text-gray-600">Despachos</div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-purple-600">{dailyReport.total_messengers}</div>
                      <div className="text-sm text-gray-600">Mensajeros</div>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {dailyReport.total_dispatches > 0 ? Math.round(dailyReport.total_cards / dailyReport.total_dispatches) : 0}
                      </div>
                      <div className="text-sm text-gray-600">Promedio por Despacho</div>
                    </div>
                  </div>

                  {/* Detailed Report */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-800">Detalle por Mensajero</h3>
                    {Object.entries(dailyReport.messengers).map(([messengerId, messengerData]) => (
                      <div key={messengerId} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex justify-between items-center mb-3">
                          <div>
                            <h4 className="font-semibold text-gray-800">{messengerData.messenger_name}</h4>
                            <p className="text-sm text-gray-600">📞 {messengerData.messenger_contact}</p>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-blue-600">{messengerData.total_cards} tarjetas</div>
                            <div className="text-sm text-gray-600">{messengerData.dispatches.length} despachos</div>
                          </div>
                        </div>
                        
                        {/* Individual Dispatches */}
                        <div className="mt-3 space-y-2">
                          {messengerData.dispatches.map((dispatch, index) => (
                            <div key={index} className="bg-white rounded p-3 border border-gray-200">
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-medium">
                                  🕒 {formatTime(dispatch.time)}
                                </span>
                                <span className="text-sm text-gray-600">
                                  {dispatch.cards} tarjetas
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                Tarjetas: {dispatch.items.map(item => item.card_number).join(', ')}
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
    </div>
  );
}

export default App;
