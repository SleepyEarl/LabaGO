
import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabaseClient';
import { usePWAInstall } from './hooks/usePWAInstall';

const ORDER_STATUSES = [
  'Pending',
  'Confirmed',
  'Rider Assigned',
  'Picked Up',
  'Washing',
  'Ready for Delivery',
  'Out for Delivery',
  'Completed',
  'Cancelled',
];

const PAYMENT_STATUSES = [
  'Pending',
  'Paid',
  'Failed',
  'Refunded',
];

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f4f8f8',
    color: '#173b3b',
    fontFamily: 'Arial, sans-serif',
  },
  header: {
    background: '#087f80',
    color: 'white',
    padding: '20px 5%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  layout: {
    display: 'flex',
    minHeight: 'calc(100vh - 76px)',
  },
  sidebar: {
    width: 220,
    background: 'white',
    padding: 18,
    borderRight: '1px solid #e1eeee',
    flexShrink: 0,
  },
  content: {
    flex: 1,
    minWidth: 0,
    padding: '28px 4%',
  },
  navButton: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '12px 14px',
    marginBottom: 7,
    border: 0,
    borderRadius: 9,
    background: 'transparent',
    color: '#315454',
    cursor: 'pointer',
    fontSize: 14,
  },
  card: {
    background: 'white',
    border: '1px solid #e4eeee',
    borderRadius: 13,
    padding: 20,
    boxShadow: '0 3px 12px rgba(0,0,0,0.03)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 15,
    marginBottom: 22,
  },
  tableWrap: {
    overflowX: 'auto',
    background: 'white',
    borderRadius: 12,
    border: '1px solid #e4eeee',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: 680,
    fontSize: 13,
  },
  th: {
    textAlign: 'left',
    padding: 13,
    background: '#edf6f6',
    color: '#315454',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: 13,
    borderTop: '1px solid #edf1f1',
    verticalAlign: 'middle',
  },
  input: {
    width: '100%',
    padding: '11px 12px',
    border: '1px solid #cbdcda',
    borderRadius: 8,
    boxSizing: 'border-box',
    fontSize: 14,
    marginTop: 5,
  },
  button: {
    padding: '10px 14px',
    border: 0,
    borderRadius: 8,
    background: '#087f80',
    color: 'white',
    cursor: 'pointer',
    fontWeight: 600,
  },
  secondaryButton: {
    padding: '9px 12px',
    border: '1px solid #cbdcda',
    borderRadius: 8,
    background: 'white',
    color: '#315454',
    cursor: 'pointer',
  },
};


function money(value) {
  return `₱${Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function prettyStatus(value) {
  return String(value || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getLocalDateKey(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getOrderCompletionDate(order) {
  const history = (order.order_status_history || [])
    .filter((item) => item.status === 'Completed')
    .sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at)
    );

  if (history.length > 0) {
    return history[history.length - 1].created_at;
  }

  return order.updated_at || order.created_at;
}

function getNotificationStorageKey(userId) {
  return `labago-admin-notifications-${userId}`;
}

function getOrderCursorStorageKey(userId) {
  return `labago-admin-order-cursor-${userId}`;
}

function readOrderCursor(userId) {
  const savedCursor = window.localStorage.getItem(
    getOrderCursorStorageKey(userId)
  );

  if (!savedCursor) return null;

  try {
    const cursor = JSON.parse(savedCursor);
    if (
      typeof cursor.createdAt === 'string' &&
      Array.isArray(cursor.ids)
    ) {
      return cursor;
    }
  } catch (error) {
    console.error('Unable to read the saved admin order cursor:', error);
  }

  return null;
}

function saveOrderCursor(userId, orders) {
  if (orders.length === 0) return null;

  const latestCreatedAt = orders.reduce(
    (latest, order) =>
      order.created_at > latest ? order.created_at : latest,
    ''
  );
  const cursor = {
    createdAt: latestCreatedAt,
    ids: orders
      .filter((order) => order.created_at === latestCreatedAt)
      .map((order) => order.id),
  };

  window.localStorage.setItem(
    getOrderCursorStorageKey(userId),
    JSON.stringify(cursor)
  );

  return cursor;
}

function AdminDashboard({ user, profile, onSignOut }) {
  const [activeTab, setActiveTab] = useState('Overview');
  const [visitedTabs, setVisitedTabs] = useState(() => new Set(['Overview']));
  const [orders, setOrders] = useState([]);
  const { canInstall, isInstalled, installApp } = usePWAInstall();
  const [services, setServices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [notifications, setNotifications] = useState(() => {
    const savedNotifications = window.localStorage.getItem(
      getNotificationStorageKey(user.id)
    );

    if (!savedNotifications) return [];

    try {
      const parsedNotifications = JSON.parse(savedNotifications);
      return Array.isArray(parsedNotifications) ? parsedNotifications : [];
    } catch (error) {
      console.error('Unable to read saved admin notifications:', error);
      return [];
    }
  });
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const knownOrderIdsRef = useRef(new Set());
  const initialOrdersLoadedRef = useRef(false);
  const orderCursorRef = useRef(null);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [orderSearch, setOrderSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const [serviceForm, setServiceForm] = useState({
    id: '',
    name: '',
    description: '',
    price: '',
    unit: '',
    icon_key: '',
    is_active: true,
  });

  const [businessSettings, setBusinessSettings] = useState(null);
  const [settingsForm, setSettingsForm] = useState({
    business_name: 'LabaGO',
    contact_number: '',
    contact_email: '',
    business_address: '',
    pickup_start_time: '',
    pickup_end_time: '',
    accepting_orders: true,
  });
  const [settingsLoading, setSettingsLoading] = useState(false);



async function loadBusinessSettings() {
  setSettingsLoading(true);

  const { data, error } = await supabase
    .from('business_settings')
    .select('*')
    .eq('id', 1)
    .single();

  if (error) {
    setError(error.message);
  } else {
    setBusinessSettings(data);

    setSettingsForm({
      business_name: data.business_name || 'LabaGO',
      contact_number: data.contact_number || '',
      contact_email: data.contact_email || '',
      business_address: data.business_address || '',
      pickup_start_time: data.pickup_start_time
        ? String(data.pickup_start_time).slice(0, 5)
        : '',
      pickup_end_time: data.pickup_end_time
        ? String(data.pickup_end_time).slice(0, 5)
        : '',
      accepting_orders: data.accepting_orders ?? true,
    });
  }

  setSettingsLoading(false);
}


async function saveBusinessSettings(event) {
  event.preventDefault();

  const businessName = settingsForm.business_name.trim();

  if (!businessName) {
    setError('Please enter your business name.');
    return;
  }

  if (
    settingsForm.pickup_start_time &&
    settingsForm.pickup_end_time &&
    settingsForm.pickup_start_time >= settingsForm.pickup_end_time
  ) {
    setError('Pickup end time must be later than the start time.');
    return;
  }

  setSaving(true);
  setError('');
  setNotice('');

  const { data, error } = await supabase
    .from('business_settings')
    .update({
      business_name: businessName,
      contact_number: settingsForm.contact_number.trim() || null,
      contact_email: settingsForm.contact_email.trim() || null,
      business_address: settingsForm.business_address.trim() || null,
      pickup_start_time: settingsForm.pickup_start_time || null,
      pickup_end_time: settingsForm.pickup_end_time || null,
      accepting_orders: settingsForm.accepting_orders,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq('id', 1)
    .select()
    .single();

  if (error) {
    setError(error.message);
  } else {
    setBusinessSettings(data);
    setNotice('Business settings saved successfully.');
  }

  setSaving(false);
}


  
async function loadDashboard(silent = false) {
  if (!silent) setLoading(true);

  setError('');

  const [
    ordersResult,
    servicesResult,
    customersResult,
    paymentsResult,
  ] = await Promise.all([
    supabase
      .from('orders')
      .select('*, order_items(*), order_status_history(*)')
      .order('created_at', { ascending: false }),

    supabase
      .from('services')
      .select('*')
      .order('created_at', { ascending: false }),

    supabase
      .from('profiles')
      .select('id, full_name, phone, created_at')
      .order('created_at', { ascending: false }),

    supabase
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false }),
  ]);

  const firstError =
    ordersResult.error ||
    servicesResult.error ||
    customersResult.error ||
    paymentsResult.error;

  if (firstError) {
    setError(firstError.message);
  } else {
    const orderData = ordersResult.data || [];

    setOrders(orderData);
    setServices(servicesResult.data || []);
    setCustomers(customersResult.data || []);
    setPayments(paymentsResult.data || []);

    if (!initialOrdersLoadedRef.current) {
      const savedCursor = readOrderCursor(user.id);
      orderCursorRef.current = savedCursor;

      const ordersSinceLastVisit = savedCursor
        ? orderData.filter(
            (order) =>
              order.created_at > savedCursor.createdAt ||
              (order.created_at === savedCursor.createdAt &&
                !savedCursor.ids.includes(order.id))
          )
        : [];

      knownOrderIdsRef.current = new Set(
        orderData.map((order) => order.id)
      );
      initialOrdersLoadedRef.current = true;

      if (ordersSinceLastVisit.length > 0) {
        setNotifications((previous) =>
          [
            ...ordersSinceLastVisit.map((order) => ({
              id: order.id,
              orderId: order.id,
              title: `New Order #${order.order_number}`,
              message: 'A customer has placed a new laundry order.',
              created_at: order.created_at,
              read: false,
            })),
            ...previous,
          ].slice(0, 20)
        );
      }

      orderCursorRef.current =
        saveOrderCursor(user.id, orderData) || savedCursor;
    }
  }

  if (!silent) setLoading(false);
}


  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
  loadBusinessSettings();
}, []);

  useEffect(() => {
    window.localStorage.setItem(
      getNotificationStorageKey(user.id),
      JSON.stringify(notifications)
    );
  }, [notifications, user.id]);

useEffect(() => {
  if (loading || !initialOrdersLoadedRef.current) return;

  async function checkForNewOrders() {
    let orderQuery = supabase
      .from('orders')
      .select('id, order_number, created_at')
      .order('created_at', { ascending: false });

    if (orderCursorRef.current) {
      orderQuery = orderQuery.gte(
        'created_at',
        orderCursorRef.current.createdAt
      );
    } else {
      orderQuery = orderQuery.limit(50);
    }

    const { data, error } = await orderQuery;

    if (error) {
      setError(`Unable to check for new orders: ${error.message}`);
      return;
    }

    if (!data) return;

    const newOrders = data.filter(
      (order) => !knownOrderIdsRef.current.has(order.id)
    );

    newOrders.forEach((order) => {
      knownOrderIdsRef.current.add(order.id);
    });

    orderCursorRef.current =
      saveOrderCursor(user.id, data) || orderCursorRef.current;

    if (newOrders.length === 0) return;

    const newNotifications = newOrders.map((order) => ({
      id: order.id,
      orderId: order.id,
      title: `New Order #${order.order_number}`,
      message: 'A customer has placed a new laundry order.',
      created_at: order.created_at,
      read: false,
    }));

    setNotifications((previous) =>
      [...newNotifications, ...previous].slice(0, 20)
    );

    await loadDashboard(true);
  }

  checkForNewOrders();

const intervalId = window.setInterval(
  checkForNewOrders,
  30000
);

return () => window.clearInterval(intervalId);
}, [loading, user.id]);


  function selectTab(tab) {
    setActiveTab(tab);
    setVisitedTabs((currentTabs) => {
      if (currentTabs.has(tab)) return currentTabs;

      const nextTabs = new Set(currentTabs);
      nextTabs.add(tab);
      return nextTabs;
    });
  }

  async function updateOrderStatus(order, newStatus) {
    if (newStatus === order.status) return;

    setSaving(true);
    setError('');
    setNotice('');

    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    const { error: historyError } = await supabase
      .from('order_status_history')
      .insert({
        order_id: order.id,
        changed_by: user.id,
        status: newStatus,
        note: `Order status changed to ${prettyStatus(newStatus)} by admin.`,
      });

    if (historyError) {
      setError(
        `Order status was updated, but tracking history could not be saved: ${historyError.message}`
      );
    } else {
      setNotice(`Order #${order.order_number} status updated.`);
    }

    await loadDashboard();
    setSaving(false);
  }

  function startNewService() {
    setServiceForm({
      id: '',
      name: '',
      description: '',
      price: '',
      unit: '',
      icon_key: '',
      is_active: true,
    });
  }

  function editService(service) {
    setServiceForm({
      id: service.id,
      name: service.name || '',
      description: service.description || '',
      price: String(service.price ?? ''),
      unit: service.unit || '',
      icon_key: service.icon_key || '',
      is_active: service.is_active ?? true,
    });
    selectTab('Services');
  }

  async function saveService(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');

    const serviceData = {
      name: serviceForm.name.trim(),
      description: serviceForm.description.trim() || null,
      price: Number(serviceForm.price),
      unit: serviceForm.unit.trim(),
      icon_key: serviceForm.icon_key.trim() || null,
      is_active: serviceForm.is_active,
    };

    if (
      !serviceData.name ||
      !serviceData.unit ||
      !Number.isFinite(serviceData.price) ||
      serviceData.price < 0
    ) {
      setError('Please enter a valid service name, unit, and price.');
      setSaving(false);
      return;
    }

    let result;

    if (serviceForm.id) {
      result = await supabase
        .from('services')
        .update(serviceData)
        .eq('id', serviceForm.id);
    } else {
      result = await supabase
        .from('services')
        .insert(serviceData);
    }

    if (result.error) {
      setError(result.error.message);
    } else {
      setNotice(
        serviceForm.id ? 'Service updated successfully.' : 'Service added successfully.'
      );
      startNewService();
      await loadDashboard();
    }

    setSaving(false);
  }

  async function toggleService(service) {
    setSaving(true);
    setError('');
    setNotice('');

    const { error: updateError } = await supabase
      .from('services')
      .update({ is_active: !service.is_active })
      .eq('id', service.id);

    if (updateError) {
      setError(updateError.message);
    } else {
      setNotice(
        service.is_active
          ? 'Service deactivated.'
          : 'Service activated.'
      );
      await loadDashboard();
    }

    setSaving(false);
  }

  async function updatePaymentStatus(payment, newStatus) {
    if (newStatus === payment.status) return;

    setSaving(true);
    setError('');
    setNotice('');

    const { error: updateError } = await supabase
      .from('payments')
      .update({ status: newStatus })
      .eq('id', payment.id);

    if (updateError) {
      setError(updateError.message);
    } else {
      setNotice('Payment status updated.');
      await loadDashboard();
    }

    setSaving(false);
  }

const pendingOrders = orders.filter(
  (order) => order.status === 'Pending'
).length;

const completedOrders = orders.filter(
  (order) => order.status === 'Completed'
).length;

function getCustomerInfo(customerId) {
  return customers.find((customer) => customer.id === customerId);
}

const filteredOrders = orders.filter((order) => {
  const customer = getCustomerInfo(order.customer_id);
  const search = orderSearch.trim().toLowerCase();

  const searchableValues = [
    order.order_number,
    order.id,
    customer?.full_name,
    customer?.phone,
    order.pickup_address,
  ];

  const matchesSearch =
    !search ||
    searchableValues.some((value) =>
      String(value ?? '').toLowerCase().includes(search)
    );

  const matchesStatus =
    statusFilter === 'All' || order.status === statusFilter;

  return matchesSearch && matchesStatus;
});

  const revenue = orders
    .filter((order) => order.status === 'completed')
    .reduce((total, order) => total + Number(order.total || 0), 0);

  
const paidPayments = payments.filter(
  (payment) => payment.status === 'Paid'
);

const paidPaymentTotal = paidPayments.reduce(
  (total, payment) => total + Number(payment.amount || 0),
  0
);

const averageOrderValue =
  completedOrders > 0 ? revenue / completedOrders : 0;

const today = new Date();

const dailyOrderData = Array.from({ length: 7 }, (_, index) => {
  const date = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - (6 - index)
  );

  const dateKey = getLocalDateKey(date);

  return {
    label: date.toLocaleDateString('en-PH', {
      weekday: 'short',
    }),
    value: orders.filter(
      (order) => getLocalDateKey(order.created_at) === dateKey
    ).length,
  };
});

const monthlyRevenueData = Array.from({ length: 6 }, (_, index) => {
  const date = new Date(
    today.getFullYear(),
    today.getMonth() - (5 - index),
    1
  );

  const monthKey = getLocalDateKey(date).slice(0, 7);

  const monthRevenue = orders
    .filter((order) => order.status === 'Completed')
    .filter((order) => {
      const completionDate = getOrderCompletionDate(order);
      return getLocalDateKey(completionDate).slice(0, 7) === monthKey;
    })
    .reduce((total, order) => total + Number(order.total || 0), 0);

  return {
    label: date.toLocaleDateString('en-PH', {
      month: 'short',
    }),
    value: monthRevenue,
  };
});

const maxMonthlyRevenue = Math.max(
  ...monthlyRevenueData.map((item) => item.value),
  1
);

const maxDailyOrders = Math.max(
  ...dailyOrderData.map((item) => item.value),
  1
);

const paymentStatusSummary = PAYMENT_STATUSES.map((status) => {
  const matchingPayments = payments.filter(
    (payment) => payment.status === status
  );

  return {
    status,
    count: matchingPayments.length,
    amount: matchingPayments.reduce(
      (total, payment) => total + Number(payment.amount || 0),
      0
    ),
  };
});


  const tabs = [
  'Overview',
  'Analytics',
  'Orders',
  'Services',
  'Customers',
  'Payments',
  'Settings',
];

const unreadNotificationCount = notifications.filter(
  (notification) => !notification.read
).length;


function renderAnalytics() {
  return (
    <>
      <div style={styles.grid}>
        <div style={styles.card}>
          <p style={{ color: '#688080', fontSize: 13, margin: '0 0 10px' }}>
            Completed Sales
          </p>
          <h2 style={{ color: '#087f80', margin: 0 }}>
            {money(revenue)}
          </h2>
          <small style={{ color: '#799090' }}>
            {completedOrders} completed orders
          </small>
        </div>

        <div style={styles.card}>
          <p style={{ color: '#688080', fontSize: 13, margin: '0 0 10px' }}>
            Payments Marked Paid
          </p>
          <h2 style={{ color: '#087f80', margin: 0 }}>
            {money(paidPaymentTotal)}
          </h2>
          <small style={{ color: '#799090' }}>
            {paidPayments.length} paid payment records
          </small>
        </div>

        <div style={styles.card}>
          <p style={{ color: '#688080', fontSize: 13, margin: '0 0 10px' }}>
            Average Order Value
          </p>
          <h2 style={{ color: '#087f80', margin: 0 }}>
            {money(averageOrderValue)}
          </h2>
          <small style={{ color: '#799090' }}>
            Based on completed orders
          </small>
        </div>

        <div style={styles.card}>
          <p style={{ color: '#688080', fontSize: 13, margin: '0 0 10px' }}>
            Total Customers
          </p>
          <h2 style={{ color: '#087f80', margin: 0 }}>
            {customers.length}
          </h2>
          <small style={{ color: '#799090' }}>
            Registered customer profiles
          </small>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div style={styles.card}>
          <h3 style={{ marginTop: 0 }}>Monthly Completed Revenue</h3>
          <p style={{ color: '#799090', fontSize: 12 }}>
            Last 6 months
          </p>

          <div
            style={{
              height: 190,
              display: 'flex',
              alignItems: 'flex-end',
              gap: 10,
              paddingTop: 15,
            }}
          >
            {monthlyRevenueData.map((item) => (
              <div
                key={item.label}
                style={{
                  flex: 1,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  gap: 7,
                  minWidth: 0,
                }}
              >
                <small
                  style={{
                    fontSize: 10,
                    color: '#688080',
                    textAlign: 'center',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {item.value > 0
                    ? money(item.value)
                    : '₱0'}
                </small>

                <div
                  style={{
                    width: '75%',
                    maxWidth: 42,
                    height: `${Math.max(
                      (item.value / maxMonthlyRevenue) * 100,
                      item.value > 0 ? 5 : 0
                    )}%`,
                    minHeight: item.value > 0 ? 5 : 0,
                    background: '#0D9488',
                    borderRadius: '6px 6px 0 0',
                  }}
                />

                <small style={{ color: '#688080' }}>
                  {item.label}
                </small>
              </div>
            ))}
          </div>
        </div>

        <div style={styles.card}>
          <h3 style={{ marginTop: 0 }}>Daily Orders</h3>
          <p style={{ color: '#799090', fontSize: 12 }}>
            Orders received in the last 7 days
          </p>

          <div
            style={{
              height: 190,
              display: 'flex',
              alignItems: 'flex-end',
              gap: 10,
              paddingTop: 15,
            }}
          >
            {dailyOrderData.map((item) => (
              <div
                key={item.label}
                style={{
                  flex: 1,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  gap: 7,
                }}
              >
                <small style={{ color: '#688080', fontSize: 12 }}>
                  {item.value}
                </small>

                <div
                  style={{
                    width: '75%',
                    maxWidth: 42,
                    height: `${Math.max(
                      (item.value / maxDailyOrders) * 100,
                      item.value > 0 ? 5 : 0
                    )}%`,
                    minHeight: item.value > 0 ? 5 : 0,
                    background: '#49B9AA',
                    borderRadius: '6px 6px 0 0',
                  }}
                />

                <small style={{ color: '#688080' }}>
                  {item.label}
                </small>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={{ marginTop: 0 }}>Payment Status Overview</h3>

        {paymentStatusSummary.map((item) => (
          <div
            key={item.status}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
              padding: '14px 0',
              borderBottom: '1px solid #edf1f1',
            }}
          >
            <div>
              <strong>{item.status}</strong>
              <div style={{ color: '#799090', fontSize: 12, marginTop: 4 }}>
                {item.count} payment records
              </div>
            </div>

            <strong style={{ color: '#087f80' }}>
              {money(item.amount)}
            </strong>
          </div>
        ))}

        {payments.length === 0 && (
          <p style={{ color: '#799090' }}>No payment records available.</p>
        )}
      </div>

      <p style={{ color: '#799090', fontSize: 12, marginTop: 15 }}>
        Revenue is calculated from orders currently marked Completed.
        Payment totals are calculated separately from payment records
        marked Paid. These figures are not necessarily the same.
      </p>
    </>
  );
}


  function renderOverview() {
    return (
      <>
        <div style={styles.grid}>
          {[
            ['Total Orders', orders.length],
            ['Pending Orders', pendingOrders],
            ['Completed Orders', completedOrders],
            ['Completed Revenue', money(revenue)],
          ].map(([label, value]) => (
            <div style={styles.card} key={label}>
              <p style={{ color: '#688080', margin: '0 0 12px', fontSize: 13 }}>
                {label}
              </p>
              <h2 style={{ margin: 0, color: '#087f80' }}>{value}</h2>
            </div>
          ))}
        </div>

        <div style={styles.card}>
          <h3 style={{ marginTop: 0 }}>Recent Orders</h3>
          {orders.length === 0 ? (
            <p>No orders have been placed yet.</p>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Order</th>
                    <th style={styles.th}>Customer ID</th>
                    <th style={styles.th}>Pickup Date</th>
                    <th style={styles.th}>Total</th>
                    <th style={styles.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.slice(0, 5).map((order) => (
                    <tr key={order.id}>
                      <td style={styles.td}>
                        <strong>
                        {getCustomerInfo(order.customer_id)?.full_name || 'Unknown Customer'}
                      </strong>
                      <div style={{ color: '#799090', marginTop: 4 }}>
                        {getCustomerInfo(order.customer_id)?.phone || 'No phone number'}
                    </div>
                    </td>
                      <td style={styles.td}>
                      {getCustomerInfo(order.customer_id)?.full_name || 'Unknown Customer'}
                      </td>
                      <td style={styles.td}>{order.pickup_date}</td>
                      <td style={styles.td}>{money(order.total)}</td>
                      <td style={styles.td}>{prettyStatus(order.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>
    );
  }



function renderOrderDetails(order) {
  const customer = getCustomerInfo(order.customer_id);

  const history = [...(order.order_status_history || [])].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  );

  return (
    <div style={{ ...styles.card, marginBottom: 18 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Order #{order.order_number}</h2>
          <p style={{ color: '#799090', fontSize: 13 }}>
            Placed {new Date(order.created_at).toLocaleString()}
          </p>
        </div>

        <button
          style={styles.secondaryButton}
          onClick={() => setSelectedOrderId(null)}
          type="button"
        >
          Close Details
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 15,
          marginTop: 18,
        }}
      >
        <div>
          <h4>Customer Information</h4>
          <strong>{customer?.full_name || 'Unknown Customer'}</strong>
          <p style={{ color: '#688080', fontSize: 13 }}>
            {customer?.phone || 'No phone number'}
          </p>
          <p style={{ color: '#799090', fontSize: 11 }}>
            Customer ID: {order.customer_id}
          </p>
        </div>

        <div>
          <h4>Pickup Information</h4>
          <p>{order.pickup_address}</p>
          <p style={{ color: '#688080', fontSize: 13 }}>
            Date: {order.pickup_date}
          </p>
          <p style={{ color: '#688080', fontSize: 13 }}>
            Time: {order.pickup_time}
          </p>
        </div>

        <div>
          <h4>Payment Information</h4>
          <p>Method: {order.payment_method}</p>
          <p>Status: {prettyStatus(order.status)}</p>
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <h3>Laundry Items</h3>

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Service</th>
                <th style={styles.th}>Quantity</th>
                <th style={styles.th}>Unit Price</th>
                <th style={styles.th}>Total</th>
              </tr>
            </thead>

            <tbody>
              {(order.order_items || []).map((item) => (
                <tr key={item.id}>
                  <td style={styles.td}>{item.service_name}</td>
                  <td style={styles.td}>
                    {item.quantity} {item.unit}
                  </td>
                  <td style={styles.td}>{money(item.unit_price)}</td>
                  <td style={styles.td}>{money(item.line_total)}</td>
                </tr>
              ))}

              {(!order.order_items || order.order_items.length === 0) && (
                <tr>
                  <td style={styles.td} colSpan="4">
                    No order items found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div
          style={{
            marginTop: 15,
            marginLeft: 'auto',
            maxWidth: 280,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span>Subtotal</span>
            <strong>{money(order.subtotal)}</strong>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span>Discount</span>
            <strong>{money(order.discount)}</strong>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              borderTop: '1px solid #e4eeee',
              paddingTop: 12,
              color: '#087f80',
              fontSize: 18,
            }}
          >
            <strong>Total</strong>
            <strong>{money(order.total)}</strong>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 25 }}>
        <h3>Order Tracking History</h3>

        {history.length > 0 ? (
          <div style={{ borderLeft: '2px solid #b8e1dc', marginLeft: 8, paddingLeft: 20 }}>
            {history.map((entry) => (
              <div
                key={entry.id}
                style={{ position: 'relative', paddingBottom: 18 }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: -26,
                    top: 3,
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: '#0D9488',
                  }}
                />

                <strong>{prettyStatus(entry.status)}</strong>

                <p style={{ color: '#799090', fontSize: 12, margin: '5px 0' }}>
                  {new Date(entry.created_at).toLocaleString()}
                </p>

                {entry.note && (
                  <p style={{ color: '#526d6d', fontSize: 13 }}>
                    {entry.note}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: '#799090' }}>
            No tracking history available yet.
          </p>
        )}
      </div>
    </div>
  );
}



function renderOrders() {
  const selectedOrder = orders.find(
    (order) => order.id === selectedOrderId
  );

  return (
    <div>
      {selectedOrder && renderOrderDetails(selectedOrder)}

      <div
        style={{
          ...styles.card,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 15,
          marginBottom: 16,
        }}
      >
        <div>
          <label style={{ fontSize: 13, fontWeight: 600 }}>
            Search Orders
          </label>
          <input
            style={styles.input}
            type="text"
            placeholder="Order number, name, phone, address..."
            value={orderSearch}
            onChange={(event) => setOrderSearch(event.target.value)}
          />
        </div>

        <div>
          <label style={{ fontSize: 13, fontWeight: 600 }}>
            Filter by Status
          </label>
          <select
            style={styles.input}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="All">All Orders</option>
            {ORDER_STATUSES.map((status) => (
              <option value={status} key={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p style={{ color: '#688080', fontSize: 13 }}>
        Showing {filteredOrders.length} of {orders.length} orders
      </p>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Order</th>
              <th style={styles.th}>Customer</th>
              <th style={styles.th}>Pickup Details</th>
              <th style={styles.th}>Items</th>
              <th style={styles.th}>Total</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Action</th>
            </tr>
          </thead>

          <tbody>
            {filteredOrders.map((order) => {
              const customer = getCustomerInfo(order.customer_id);

              return (
                <tr key={order.id}>
                  <td style={styles.td}>
                    <strong>#{order.order_number}</strong>
                    <div style={{ color: '#799090', marginTop: 4 }}>
                      {new Date(order.created_at).toLocaleDateString()}
                    </div>
                  </td>

                  <td style={styles.td}>
                    <strong>
                      {customer?.full_name || 'Unknown Customer'}
                    </strong>
                    <div style={{ color: '#799090', marginTop: 4 }}>
                      {customer?.phone || 'No phone number'}
                    </div>
                  </td>

                  <td style={styles.td}>
                    {order.pickup_address}
                    <div style={{ color: '#799090', marginTop: 4 }}>
                      {order.pickup_date} · {order.pickup_time}
                    </div>
                  </td>

                  <td style={styles.td}>
                    {(order.order_items || []).map((item) => (
                      <div key={item.id}>
                        {item.service_name} × {item.quantity}
                      </div>
                    ))}
                  </td>

                  <td style={styles.td}>{money(order.total)}</td>

                  <td style={styles.td}>
                    <select
                      style={styles.input}
                      value={order.status}
                      disabled={saving}
                      onChange={(event) =>
                        updateOrderStatus(order, event.target.value)
                      }
                    >
                      {ORDER_STATUSES.map((status) => (
                        <option value={status} key={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td style={styles.td}>
                    <button
                      style={styles.secondaryButton}
                      type="button"
                      onClick={() => setSelectedOrderId(order.id)}
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              );
            })}

            {filteredOrders.length === 0 && (
              <tr>
                <td style={styles.td} colSpan="7">
                  No orders match your search or selected filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}



  function renderServices() {
    return (
      <div
  className="admin-services-grid"
  style={{
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
    gap: 18,
    alignItems: 'start',
  }}
>
        <form style={styles.card} onSubmit={saveService}>
          <h3 style={{ marginTop: 0 }}>
            {serviceForm.id ? 'Edit Service' : 'Add New Service'}
          </h3>

          <label>
            Service Name
            <input
              style={styles.input}
              value={serviceForm.name}
              onChange={(event) =>
                setServiceForm({ ...serviceForm, name: event.target.value })
              }
              required
            />
          </label>

          <label>
            Description
            <textarea
              style={{ ...styles.input, minHeight: 75, resize: 'vertical' }}
              value={serviceForm.description}
              onChange={(event) =>
                setServiceForm({
                  ...serviceForm,
                  description: event.target.value,
                })
              }
            />
          </label>

          <label>
            Price (₱)
            <input
              style={styles.input}
              type="number"
              min="0"
              step="0.01"
              value={serviceForm.price}
              onChange={(event) =>
                setServiceForm({ ...serviceForm, price: event.target.value })
              }
              required
            />
          </label>

          <label>
  Unit
  <select
    style={styles.input}
    value={serviceForm.unit}
    onChange={(event) =>
      setServiceForm({ ...serviceForm, unit: event.target.value })
    }
    required
  >
    <option value="">Select unit</option>
    <option value="kg">Kilogram (kg)</option>
    <option value="pc">Piece (pc)</option>
  </select>
</label>

          <label>
            Icon Key (optional)
            <input
              style={styles.input}
              value={serviceForm.icon_key}
              onChange={(event) =>
                setServiceForm({ ...serviceForm, icon_key: event.target.value })
              }
            />
          </label>

          <label style={{ display: 'flex', gap: 9, alignItems: 'center', margin: '14px 0' }}>
            <input
              type="checkbox"
              checked={serviceForm.is_active}
              onChange={(event) =>
                setServiceForm({
                  ...serviceForm,
                  is_active: event.target.checked,
                })
              }
            />
            Active service
          </label>

          <button style={styles.button} disabled={saving} type="submit">
            {saving ? 'Saving...' : serviceForm.id ? 'Save Changes' : 'Add Service'}
          </button>

          {serviceForm.id && (
            <button
              style={{ ...styles.secondaryButton, marginLeft: 8 }}
              type="button"
              onClick={startNewService}
            >
              Cancel
            </button>
          )}
        </form>

        <div style={styles.card}>
          <h3 style={{ marginTop: 0 }}>Laundry Services</h3>
          {services.map((service) => (
            <div
              key={service.id}
              style={{
                padding: '13px 0',
                borderBottom: '1px solid #edf1f1',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <strong>{service.name}</strong>
                <div style={{ color: '#688080', fontSize: 13, marginTop: 4 }}>
                  {money(service.price)} / {service.unit}
                </div>
                <div style={{ color: service.is_active ? '#087f80' : '#b45b5b', fontSize: 12 }}>
                  {service.is_active ? 'Active' : 'Inactive'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 7 }}>
                <button
                  style={styles.secondaryButton}
                  onClick={() => editService(service)}
                  type="button"
                >
                  Edit
                </button>
                <button
                  style={styles.secondaryButton}
                  onClick={() => toggleService(service)}
                  disabled={saving}
                  type="button"
                >
                  {service.is_active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          ))}
          {services.length === 0 && <p>No services found.</p>}
        </div>
      </div>
    );
  }

  
function renderCustomers() {
  const selectedCustomer = customers.find(
    (customer) => customer.id === selectedCustomerId
  );

  const customerOrders = selectedCustomer
    ? orders.filter(
        (order) => order.customer_id === selectedCustomer.id
      )
    : [];

  return (
    <div>
      {selectedCustomer && (
        <div style={{ ...styles.card, marginBottom: 18 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <h2 style={{ margin: 0 }}>Customer Profile</h2>

            <button
              style={styles.secondaryButton}
              type="button"
              onClick={() => setSelectedCustomerId(null)}
            >
              Close Profile
            </button>
          </div>

          <div style={{ marginTop: 18 }}>
            <h3>{selectedCustomer.full_name || 'No name provided'}</h3>

            <p>
              <strong>Phone:</strong>{' '}
              {selectedCustomer.phone || 'Not provided'}
            </p>

            <p style={{ fontSize: 12, color: '#799090' }}>
              Customer ID: {selectedCustomer.id}
            </p>

            <p style={{ fontSize: 13, color: '#688080' }}>
              Registered:{' '}
              {selectedCustomer.created_at
                ? new Date(selectedCustomer.created_at).toLocaleDateString()
                : 'Unknown'}
            </p>
          </div>

          <div style={styles.grid}>
            <div>
              <p style={{ color: '#688080', fontSize: 13 }}>
                Total Orders
              </p>
              <h2 style={{ color: '#087f80' }}>
                {customerOrders.length}
              </h2>
            </div>

            <div>
              <p style={{ color: '#688080', fontSize: 13 }}>
                Completed Orders
              </p>
              <h2 style={{ color: '#087f80' }}>
                {customerOrders.filter(
                  (order) => order.status === 'Completed'
                ).length}
              </h2>
            </div>

            <div>
              <p style={{ color: '#688080', fontSize: 13 }}>
                Total Completed Sales
              </p>
              <h2 style={{ color: '#087f80' }}>
                {money(
                  customerOrders
                    .filter((order) => order.status === 'Completed')
                    .reduce(
                      (total, order) => total + Number(order.total || 0),
                      0
                    )
                )}
              </h2>
            </div>
          </div>

          <h3>Customer Order History</h3>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Order</th>
                  <th style={styles.th}>Pickup Date</th>
                  <th style={styles.th}>Total</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Action</th>
                </tr>
              </thead>

              <tbody>
                {customerOrders.map((order) => (
                  <tr key={order.id}>
                    <td style={styles.td}>#{order.order_number}</td>
                    <td style={styles.td}>{order.pickup_date}</td>
                    <td style={styles.td}>{money(order.total)}</td>
                    <td style={styles.td}>{prettyStatus(order.status)}</td>
                    <td style={styles.td}>
                      <button
                        style={styles.secondaryButton}
                        type="button"
                        onClick={() => {
                          setSelectedOrderId(order.id);
                          selectTab('Orders');
                        }}
                      >
                        View Order
                      </button>
                    </td>
                  </tr>
                ))}

                {customerOrders.length === 0 && (
                  <tr>
                    <td style={styles.td} colSpan="5">
                      This customer has no orders yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Full Name</th>
              <th style={styles.th}>Phone</th>
              <th style={styles.th}>Customer ID</th>
              <th style={styles.th}>Registered</th>
              <th style={styles.th}>Orders</th>
              <th style={styles.th}>Action</th>
            </tr>
          </thead>

          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id}>
                <td style={styles.td}>
                  {customer.full_name || 'No name provided'}
                </td>

                <td style={styles.td}>
                  {customer.phone || '—'}
                </td>

                <td style={styles.td}>{customer.id}</td>

                <td style={styles.td}>
                  {customer.created_at
                    ? new Date(customer.created_at).toLocaleDateString()
                    : '—'}
                </td>

                <td style={styles.td}>
                  {orders.filter(
                    (order) => order.customer_id === customer.id
                  ).length}
                </td>

                <td style={styles.td}>
                  <button
                    style={styles.secondaryButton}
                    type="button"
                    onClick={() =>
                      setSelectedCustomerId(customer.id)
                    }
                  >
                    View Profile
                  </button>
                </td>
              </tr>
            ))}

            {customers.length === 0 && (
              <tr>
                <td style={styles.td} colSpan="6">
                  No customers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

  function renderPayments() {
    return (
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Payment ID</th>
              <th style={styles.th}>Order ID</th>
              <th style={styles.th}>Amount</th>
              <th style={styles.th}>Method</th>
              <th style={styles.th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id}>
                <td style={styles.td}>{payment.id}</td>
                <td style={styles.td}>{payment.order_id}</td>
                <td style={styles.td}>{money(payment.amount)}</td>
                <td style={styles.td}>{payment.payment_method}</td>
                <td style={styles.td}>
                  <select
                    style={styles.input}
                    value={payment.status}
                    disabled={saving}
                    onChange={(event) =>
                      updatePaymentStatus(payment, event.target.value)
                    }
                  >
                    {PAYMENT_STATUSES.map((status) => (
                      <option value={status} key={status}>
                        {prettyStatus(status)}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr>
                <td style={styles.td} colSpan="5">No payment records found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  function renderSettings() {

  if (settingsLoading) {
  return <div style={styles.card}>Loading business settings...</div>;
}

if (!businessSettings) {
  return <div style={styles.card}>Business settings could not be loaded.</div>;
}
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
        gap: 18,
        alignItems: 'start',
      }}
    >
      <div style={styles.card}>
  <h3 style={{ marginTop: 0 }}>Download App (Desktop & Mobile)</h3>
  <p style={{ color: '#799090', fontSize: 13 }}>
    Install LabaGO on your computer, Android, or iPhone for quick access.
  </p>

  {isInstalled ? (
    <button type="button" style={styles.secondaryButton} disabled>
      ✓ App Already Installed
    </button>
  ) : (
    <button
      type="button"
      style={styles.button}
      onClick={async () => {
        if (canInstall) {
          await installApp();
        } else {
          alert(
            'To install LabaGO:\n\n' +
              '• Desktop (Chrome / Edge): Click the Install icon on the right side of the address bar.\n' +
              '• Android (Chrome): Tap the 3 dots (⋮) → "Install app".\n' +
              '• iPhone / iPad (Safari): Tap Share → "Add to Home Screen".'
          );
        }
      }}
    >
      Download LabaGO App
    </button>
  )}
</div>

      <form style={styles.card} onSubmit={saveBusinessSettings}>
        <h3 style={{ marginTop: 0 }}>Business Information</h3>

        <label>
          Business Name
          <input
            style={styles.input}
            value={settingsForm.business_name}
            onChange={(event) =>
              setSettingsForm({
                ...settingsForm,
                business_name: event.target.value,
              })
            }
            required
          />
        </label>

        <label>
          Contact Number
          <input
            style={styles.input}
            type="tel"
            placeholder="09XXXXXXXXX"
            value={settingsForm.contact_number}
            onChange={(event) =>
              setSettingsForm({
                ...settingsForm,
                contact_number: event.target.value,
              })
            }
          />
        </label>

        <label>
          Business Email
          <input
            style={styles.input}
            type="email"
            placeholder="labago@example.com"
            value={settingsForm.contact_email}
            onChange={(event) =>
              setSettingsForm({
                ...settingsForm,
                contact_email: event.target.value,
              })
            }
          />
        </label>

        <label>
          Business Address
          <textarea
            style={{
              ...styles.input,
              minHeight: 85,
              resize: 'vertical',
            }}
            placeholder="Enter your business address"
            value={settingsForm.business_address}
            onChange={(event) =>
              setSettingsForm({
                ...settingsForm,
                business_address: event.target.value,
              })
            }
          />
        </label>

        <button
          type="submit"
          style={{ ...styles.button, marginTop: 16 }}
          disabled={saving || settingsLoading}
        >
          {saving ? 'Saving...' : 'Save Business Information'}
        </button>
      </form>

      <div style={{ display: 'grid', gap: 18 }}>
        <form style={styles.card} onSubmit={saveBusinessSettings}>
          <h3 style={{ marginTop: 0 }}>Pickup Schedule</h3>

          <p style={{ color: '#799090', fontSize: 13 }}>
            Set the daily pickup hours for your laundry business.
          </p>

          <label>
            Pickup Start Time
            <input
              style={styles.input}
              type="time"
              value={settingsForm.pickup_start_time}
              onChange={(event) =>
                setSettingsForm({
                  ...settingsForm,
                  pickup_start_time: event.target.value,
                })
              }
            />
          </label>

          <label>
            Pickup End Time
            <input
              style={styles.input}
              type="time"
              value={settingsForm.pickup_end_time}
              onChange={(event) =>
                setSettingsForm({
                  ...settingsForm,
                  pickup_end_time: event.target.value,
                })
              }
            />
          </label>

          <p style={{ fontSize: 12, color: '#799090' }}>
            Leave both times empty if your pickup hours have not been decided.
          </p>

          <button
            type="submit"
            style={{ ...styles.button, marginTop: 10 }}
            disabled={saving || settingsLoading}
          >
            {saving ? 'Saving...' : 'Save Pickup Schedule'}
          </button>
        </form>

        <form style={styles.card} onSubmit={saveBusinessSettings}>
          <h3 style={{ marginTop: 0 }}>Order Availability</h3>

          <p style={{ color: '#799090', fontSize: 13 }}>
            Control whether LabaGO is currently accepting new orders.
          </p>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: 14,
              borderRadius: 10,
              background: settingsForm.accepting_orders
                ? '#e8f7f1'
                : '#fff0f0',
              marginTop: 15,
            }}
          >
            <input
              type="checkbox"
              checked={settingsForm.accepting_orders}
              onChange={(event) =>
                setSettingsForm({
                  ...settingsForm,
                  accepting_orders: event.target.checked,
                })
              }
            />

            <span>
              <strong>
                {settingsForm.accepting_orders
                  ? 'Accepting New Orders'
                  : 'Orders Temporarily Paused'}
              </strong>

              <small
                style={{
                  display: 'block',
                  color: '#688080',
                  marginTop: 4,
                }}
              >
                {settingsForm.accepting_orders
                  ? 'Your business is marked as available.'
                  : 'Your business is marked as unavailable.'}
              </small>
            </span>
          </label>

          <button
            type="submit"
            style={{ ...styles.button, marginTop: 18 }}
            disabled={saving || settingsLoading}
          >
            {saving ? 'Saving...' : 'Save Availability'}
          </button>
        </form>
      </div>

      <div style={{ ...styles.card, gridColumn: '1 / -1' }}>
        <h3 style={{ marginTop: 0 }}>Settings Information</h3>

        <p style={{ fontSize: 13, color: '#688080' }}>
          Last updated:{' '}
          {businessSettings?.updated_at
            ? new Date(businessSettings.updated_at).toLocaleString()
            : 'Not available'}
        </p>

        <p style={{ fontSize: 12, color: '#799090' }}>
          Changes are saved to your Supabase business_settings table.
          Pickup hours and order availability are configuration settings
          for now; they are not yet enforced by the customer checkout.
        </p>
      </div>
    </div>
  );
}

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h2 style={{ margin: 0 }}>LabaGO Admin</h2>
          <small>Management Dashboard</small>
        </div>
        
<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
  <span>{profile?.full_name || user.email}</span>

  <div style={{ position: 'relative' }}>
    <button
      onClick={() => setNotificationsOpen(!notificationsOpen)}
      style={{
        ...styles.secondaryButton,
        background: 'white',
        border: 0,
      }}
    >
      🔔 Alerts {unreadNotificationCount > 0
        ? `(${unreadNotificationCount})`
        : ''}
    </button>

    {notificationsOpen && (
      <div
        style={{
          position: 'absolute',
          top: 'calc(100% + 10px)',
          right: 0,
          width: 'min(350px, calc(100vw - 30px))',
          maxHeight: 400,
          overflowY: 'auto',
          zIndex: 30,
          background: 'white',
          color: '#173b3b',
          border: '1px solid #e1eeee',
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
          padding: 14,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
            marginBottom: 12,
          }}
        >
          <strong>Notifications</strong>

          <button
            type="button"
            style={{
              ...styles.secondaryButton,
              padding: '6px 9px',
              fontSize: 11,
            }}
            onClick={() =>
              setNotifications((previous) =>
                previous.map((item) => ({
                  ...item,
                  read: true,
                }))
              )
            }
          >
            Mark all read
          </button>
        </div>

        {notifications.length === 0 ? (
          <p style={{ color: '#799090', fontSize: 13 }}>
            No new order alerts yet.
            New orders will appear here automatically.
          </p>
        ) : (
          notifications.map((notification) => (
            <button
              key={notification.id}
              type="button"
              onClick={() => {
                selectTab('Orders');
                setSelectedOrderId(notification.orderId);

                setNotifications((previous) =>
                  previous.map((item) =>
                    item.id === notification.id
                      ? { ...item, read: true }
                      : item
                  )
                );

                setNotificationsOpen(false);
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: 12,
                marginBottom: 8,
                borderRadius: 9,
                border: '1px solid #e1eeee',
                background: notification.read ? 'white' : '#eaf7f5',
                color: '#173b3b',
                cursor: 'pointer',
                whiteSpace: 'normal',
              }}
            >
              <strong>{notification.title}</strong>

              <div style={{ fontSize: 12, marginTop: 5 }}>
                {notification.message}
              </div>

              <small style={{ color: '#799090', display: 'block', marginTop: 6 }}>
                {new Date(notification.created_at).toLocaleString()}
              </small>
            </button>
          ))
        )}
      </div>
    )}
  </div>

  <button
    onClick={onSignOut}
    style={{
      ...styles.secondaryButton,
      background: 'white',
      border: 0,
    }}
  >
    Sign Out
  </button>
</div>
    
      </header>

      <div style={styles.layout}>
        <aside style={styles.sidebar}>
          <p style={{ color: '#819595', fontSize: 12, fontWeight: 700 }}>
            ADMIN MENU
          </p>
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => selectTab(tab)}
              style={{
                ...styles.navButton,
                background: activeTab === tab ? '#e5f4f2' : 'transparent',
                color: activeTab === tab ? '#087f80' : '#315454',
                fontWeight: activeTab === tab ? 700 : 400,
              }}
            >
              {tab}

{tab === 'Orders' && pendingOrders > 0 && (
  <span
    style={{
      marginLeft: 8,
      background: '#dff3ef',
      color: '#087f80',
      padding: '3px 8px',
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 700,
    }}
  >
    {pendingOrders}
  </span>
)}
            </button>
          ))}
        </aside>

        <main style={styles.content}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
              marginBottom: 20,
            }}
          >
            <div>
              <h1 style={{ margin: 0, fontSize: 25 }}>{activeTab}</h1>
              <p style={{ color: '#718888', margin: '6px 0 0' }}>
                Manage your LabaGO laundry business.
              </p>
            </div>
            <button
              style={styles.secondaryButton}
              onClick={loadDashboard}
              disabled={loading || saving}
            >
              Refresh Data
            </button>
          </div>

          {error && (
            <div style={{
              background: '#fff0f0',
              color: '#a33b3b',
              padding: 13,
              borderRadius: 9,
              marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          {notice && (
            <div style={{
              background: '#e8f7f1',
              color: '#167354',
              padding: 13,
              borderRadius: 9,
              marginBottom: 16,
            }}>
              {notice}
            </div>
          )}

          {loading ? (
            <div style={styles.card}>Loading dashboard data...</div>
          ) : (
            <>
              {visitedTabs.has('Overview') && (
                <div hidden={activeTab !== 'Overview'}>{renderOverview()}</div>
              )}
              {visitedTabs.has('Analytics') && (
                <div hidden={activeTab !== 'Analytics'}>{renderAnalytics()}</div>
              )}
              {visitedTabs.has('Orders') && (
                <div hidden={activeTab !== 'Orders'}>{renderOrders()}</div>
              )}
              {visitedTabs.has('Services') && (
                <div hidden={activeTab !== 'Services'}>{renderServices()}</div>
              )}
              {visitedTabs.has('Customers') && (
                <div hidden={activeTab !== 'Customers'}>{renderCustomers()}</div>
              )}
              {visitedTabs.has('Payments') && (
                <div hidden={activeTab !== 'Payments'}>{renderPayments()}</div>
              )}
              {visitedTabs.has('Settings') && (
                <div hidden={activeTab !== 'Settings'}>{renderSettings()}</div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default AdminDashboard;
