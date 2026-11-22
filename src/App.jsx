
import { useEffect, useState } from 'react';
import { usePWAInstall } from './hooks/usePWAInstall';
import {
  Droplets,
  Shirt,
  Sparkles,
  BedDouble,
  House,
  ClipboardList,
  UserRound,
  ShoppingBag,
  ArrowLeft,
  Plus,
  Minus,
  Trash2,
  MapPin,
  CalendarDays,
  Clock3,
  CreditCard,
  MessageCircle,
  Phone,
  CheckCircle2,
  ChevronRight,
  Truck,
  Pencil,
  Star,
} from 'lucide-react';
import {
  placeOrder,
  getCustomerOrders,
  getServices,
} from './lib/orderService.js';
import {
  getCustomerAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from './lib/addressService.js';
import './App.css';


const serviceIcons = {
  droplets: Droplets,
  wash: Droplets,
  shirt: Shirt,
  iron: Shirt,
  sparkles: Sparkles,
  dry_clean: Sparkles,
  bed: BedDouble,
  bedding: BedDouble,
};

const formatPrice = (amount) =>
  `PHP ${Number(amount || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (date) => {
  if (!date) return 'Not available';

  return new Date(`${date}T00:00:00`).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

function App({ user, profile, role, onSignOut }) {
  const { canInstall, isInstalled, installApp } = usePWAInstall();
  const [screen, setScreen] = useState('home');
  const [cart, setCart] = useState([]);
  const [orders, setOrders] = useState([]);
  const [services, setServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [servicesError, setServicesError] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);

  const [pickupDate, setPickupDate] = useState('');
  const [pickupTime, setPickupTime] = useState('2:00 PM - 4:00 PM');
  const [payment, setPayment] = useState('Cash on pickup');

  const [orderSuccess, setOrderSuccess] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [editingAddress, setEditingAddress] = useState(null);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressSaving, setAddressSaving] = useState(false);
  const [deletingAddressId, setDeletingAddressId] = useState(null);

const emptyAddressForm = {
  label: 'Home',
  recipient_name: '',
  phone: '',
  address_line: '',
  barangay: '',
  city: '',
  province: '',
  postal_code: '',
  instructions: '',
  is_default: false,
};

const [addressForm, setAddressForm] = useState(emptyAddressForm);

  const total = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const totalItems = cart.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  const selectedAddress = savedAddresses.find(
  (item) => item.id === selectedAddressId
);

  const today = new Date();
  const localToday = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');

  const loadServices = async () => {
    setLoadingServices(true);
    setServicesError('');

    try {
      const availableServices = await getServices();
      setServices(availableServices);
    } catch (error) {
      console.error('Load services error:', error);
      setServicesError(error.message || 'Unable to load services.');
    } finally {
      setLoadingServices(false);
    }
  };

  const loadOrders = async () => {
    if (!user?.id) return;

    setLoadingOrders(true);
    setErrorMessage('');

    try {
      const customerOrders = await getCustomerOrders(user.id);
      setOrders(customerOrders);
    } catch (error) {
      console.error('Load orders error:', error);
      setErrorMessage(error.message || 'Unable to load your orders.');
    } finally {
      setLoadingOrders(false);
    }
  };

  const loadAddresses = async () => {
  if (!user?.id) return;

  setAddressLoading(true);

  try {
    const addresses = await getCustomerAddresses(user.id);

    setSavedAddresses(addresses);

    const defaultAddress = addresses.find(
      (item) => item.is_default
    );

    setSelectedAddressId((current) => {
      if (current && addresses.some((item) => item.id === current)) {
        return current;
      }

      return defaultAddress?.id || '';
    });
  } catch (error) {
    console.error('Load addresses error:', error);
    setErrorMessage(error.message || 'Unable to load saved addresses.');
  } finally {
    setAddressLoading(false);
  }
};

  

  useEffect(() => {
  loadOrders();
  loadServices();
  loadAddresses();
}, [user?.id]);

  const addToCart = (service) => {
  setCart((previous) => {
    const existing = previous.find((item) => item.id === service.id);

    if (existing) {
      return previous.map((item) =>
        item.id === service.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
    }

    const Icon =
      serviceIcons[String(service.icon_key || '').toLowerCase()] || Droplets;

    return [
      ...previous,
      {
        ...service,
        icon: Icon,
        price: Number(service.price),
        quantity: service.unit === 'kg' ? 5 : 1,
      },
    ];
  });

  setErrorMessage('');
};

  const updateQuantity = (id, change) => {
    setCart((previous) =>
      previous.map((item) =>
        item.id === id
          ? { ...item, quantity: Math.max(1, item.quantity + change) }
          : item
      )
    );
  };

  const removeFromCart = (id) => {
    setCart((previous) => previous.filter((item) => item.id !== id));
  };

  const handlePlaceOrder = async (event) => {
    event.preventDefault();

    if (!user?.id) {
      setErrorMessage('Please sign in before placing an order.');
      return;
    }

    if (!cart.length) {
      setErrorMessage('Your cart is empty.');
      return;
    }

    if (!selectedAddress || !pickupDate) {
    setErrorMessage('Please select a pickup address and date.');
    return;
    }

    setPlacingOrder(true);
    setErrorMessage('');

    try {
      await placeOrder({
    customerId: user.id,
    address: getFullAddress(selectedAddress),
    pickupDate,
    pickupTime,
    paymentMethod: payment,
    items: cart,
    });

      setCart([]);
      setPickupDate('');
      setPickupTime('2:00 PM - 4:00 PM');
      setPayment('Cash on pickup');
      setOrderSuccess(true);
      setSelectedOrder(null);

      await loadOrders();
      setScreen('orders');
    } catch (error) {
      console.error('Place order error:', error);
      setErrorMessage(
        error.message || 'Something went wrong while placing your order.'
      );
    } finally {
      setPlacingOrder(false);
    }
  };

  const openNewAddress = () => {
  setEditingAddress(null);
  setAddressForm({
    ...emptyAddressForm,
    recipient_name: profile?.full_name || '',
    phone: profile?.phone || '',
    is_default: savedAddresses.length === 0,
  });
  setErrorMessage('');
  setScreen('address-form');
};

const openEditAddress = (address) => {
  setEditingAddress(address);
  setAddressForm({
    label: address.label || 'Home',
    recipient_name: address.recipient_name || '',
    phone: address.phone || '',
    address_line: address.address_line || '',
    barangay: address.barangay || '',
    city: address.city || '',
    province: address.province || '',
    postal_code: address.postal_code || '',
    instructions: address.instructions || '',
    is_default: Boolean(address.is_default),
  });
  setErrorMessage('');
  setScreen('address-form');
};

const handleAddressFormChange = (event) => {
  const { name, value, type, checked } = event.target;

  setAddressForm((previous) => ({
    ...previous,
    [name]: type === 'checkbox' ? checked : value,
  }));
};

const handleSaveAddress = async (event) => {
  event.preventDefault();

  if (!user?.id) return;

  setAddressSaving(true);
  setErrorMessage('');

  try {
    if (editingAddress) {
      await updateAddress(user.id, editingAddress.id, addressForm);
    } else {
      await addAddress(user.id, addressForm);
    }

    await loadAddresses();
    setScreen('addresses');
  } catch (error) {
    console.error('Save address error:', error);
    setErrorMessage(error.message || 'Unable to save address.');
  } finally {
    setAddressSaving(false);
  }
};

const handleDeleteAddress = async (addressId) => {
  const confirmed = window.confirm(
    'Are you sure you want to delete this saved address?'
  );

  if (!confirmed) return;

  setErrorMessage('');
  setDeletingAddressId(addressId);

  try {
    await deleteAddress(user.id, addressId);
    await loadAddresses();
  } catch (error) {
    console.error('Delete address error:', error);
    setErrorMessage(error.message || 'Unable to delete address.');
  } finally {
    setDeletingAddressId(null);
  }
};

const handleSetDefaultAddress = async (addressId) => {
  setErrorMessage('');

  try {
    await setDefaultAddress(user.id, addressId);
    await loadAddresses();
  } catch (error) {
    console.error('Set default address error:', error);
    setErrorMessage(error.message || 'Unable to set default address.');
  }
};

const getFullAddress = (address) =>
  [
    address.address_line,
    address.barangay,
    address.city,
    address.province,
    address.postal_code,
  ]
    .filter(Boolean)
    .join(', ');

  const renderHeader = (title, backScreen = 'home') => (
    <header className="page-header">
      <button
        className="back-button"
        onClick={() => setScreen(backScreen)}
        aria-label="Go back"
      >
        <ArrowLeft size={21} />
      </button>
      <h2>{title}</h2>
      <div className="header-spacer" />
    </header>
  );

  const renderError = () =>
    errorMessage ? (
      <div className="error-message" role="alert">
        {errorMessage}
      </div>
    ) : null;

  const renderServicesStatus = () => {
    if (loadingServices) {
      return <p role="status">Loading laundry services...</p>;
    }

    if (servicesError) {
      return (
        <div className="error-message" role="alert">
          {servicesError}{' '}
          <button className="text-button" onClick={loadServices}>
            Try again
          </button>
        </div>
      );
    }

    if (services.length === 0) {
      return <p>No laundry services are currently available.</p>;
    }

    return null;
  };

  const renderAddresses = () => (
  <>
    {renderHeader('Saved Addresses', 'profile')}
    {renderError()}

    <p className="page-description">
      Manage your pickup locations.
    </p>

    <button
      className="primary-button"
      onClick={openNewAddress}
    >
      <Plus size={17} /> Add New Address
    </button>

    {addressLoading ? (
      <div className="empty-state">
        <p>Loading saved addresses...</p>
      </div>
    ) : savedAddresses.length === 0 ? (
      <div className="empty-state">
        <MapPin size={45} />
        <h3>No saved addresses</h3>
        <p>Add your home, school, or work address.</p>
      </div>
    ) : (
      <div className="orders-list">
        {savedAddresses.map((address) => (
          <article className="order-card" key={address.id}>
            <div className="order-card-top">
              <div>
                <h3>{address.label || 'My Address'}</h3>
                {address.is_default && (
                  <span className="pending-badge">Default</span>
                )}
              </div>
              <MapPin size={21} />
            </div>

            <p><strong>{address.recipient_name}</strong></p>
            <p>{address.phone}</p>
            <p>{getFullAddress(address)}</p>

            {address.instructions && (
              <p className="page-description">
                Instructions: {address.instructions}
              </p>
            )}

            <div className="support-actions">
              <button onClick={() => openEditAddress(address)}>
                <Pencil size={15} /> Edit
              </button>

              {!address.is_default && (
                <button
                  onClick={() => handleSetDefaultAddress(address.id)}
                >
                  <Star size={15} /> Set Default
                </button>
              )}

              <button
        type="button"
       onClick={() => {
        console.log('Delete clicked:', address.id);
        handleDeleteAddress(address.id);
        }}
          >
          <Trash2 size={15} /> Delete
            </button>
            </div>
          </article>
        ))}
      </div>
    )}
  </>
);

  const renderAddressForm = () => (
    <>
      {renderHeader(
        editingAddress ? 'Edit Address' : 'Add a Home Address',
        'addresses'
      )}
      {renderError()}

      <p className="page-description">
        Enter the pickup location and contact details for this address.
      </p>

      <form
        className="checkout-form address-form"
        onSubmit={handleSaveAddress}
      >
        <section className="form-section address-fields">
          <div className="address-field">
            <label htmlFor="address-label">Address label</label>
            <input
              id="address-label"
              name="label"
              type="text"
              value={addressForm.label}
              onChange={handleAddressFormChange}
              placeholder="Home"
              required
            />
          </div>

          <div className="address-field">
            <label htmlFor="address-recipient">Recipient name</label>
            <input
              id="address-recipient"
              name="recipient_name"
              type="text"
              value={addressForm.recipient_name}
              onChange={handleAddressFormChange}
              autoComplete="name"
              required
            />
          </div>

          <div className="address-field">
            <label htmlFor="address-phone">Phone number</label>
            <input
              id="address-phone"
              name="phone"
              type="tel"
              value={addressForm.phone}
              onChange={handleAddressFormChange}
              autoComplete="tel"
              required
            />
          </div>

          <div className="address-field address-field-full">
            <label htmlFor="address-line">Street address</label>
            <input
              id="address-line"
              name="address_line"
              type="text"
              value={addressForm.address_line}
              onChange={handleAddressFormChange}
              autoComplete="street-address"
              placeholder="House number, street, subdivision"
              required
            />
          </div>

          <div className="address-field">
            <label htmlFor="address-barangay">Barangay</label>
            <input
              id="address-barangay"
              name="barangay"
              type="text"
              value={addressForm.barangay}
              onChange={handleAddressFormChange}
              autoComplete="address-level3"
            />
          </div>

          <div className="address-field">
            <label htmlFor="address-city">City / Municipality</label>
            <input
              id="address-city"
              name="city"
              type="text"
              value={addressForm.city}
              onChange={handleAddressFormChange}
              autoComplete="address-level2"
              required
            />
          </div>

          <div className="address-field">
            <label htmlFor="address-province">Province</label>
            <input
              id="address-province"
              name="province"
              type="text"
              value={addressForm.province}
              onChange={handleAddressFormChange}
              autoComplete="address-level1"
            />
          </div>

          <div className="address-field">
            <label htmlFor="address-postal-code">Postal code</label>
            <input
              id="address-postal-code"
              name="postal_code"
              type="text"
              value={addressForm.postal_code}
              onChange={handleAddressFormChange}
              autoComplete="postal-code"
            />
          </div>

          <div className="address-field address-field-full">
            <label htmlFor="address-instructions">
              Pickup instructions (optional)
            </label>
            <textarea
              id="address-instructions"
              name="instructions"
              value={addressForm.instructions}
              onChange={handleAddressFormChange}
              rows={3}
              placeholder="Gate code, landmarks, or delivery notes"
            />
          </div>

          <label className="address-default-option">
            <input
              name="is_default"
              type="checkbox"
              checked={addressForm.is_default}
              onChange={handleAddressFormChange}
            />
            <span>Set as my default pickup address</span>
          </label>
        </section>

        <button
          className="primary-button place-order-button"
          type="submit"
          disabled={addressSaving}
        >
          {addressSaving
            ? 'Saving Address...'
            : editingAddress
              ? 'Save Changes'
              : 'Save Address'}
        </button>
      </form>
    </>
  );

  const renderHome = () => {
    const activeOrder = orders.find(
      (order) =>
        !['Completed', 'Cancelled'].includes(order.status)
    );

    return (
      <>
        <header className="home-header">
          <div>
            <p className="greeting">Welcome back!</p>
            <h1>Hi, {profile?.full_name?.trim().split(' ')[0] || 'there'}!</h1>
            <p className="subtitle">What are we washing today?</p>
          </div>

          <div className="brand-mark">
            <Droplets size={25} />
          </div>
        </header>

        {activeOrder ? (
          <section className="active-order">
            <div className="active-order-top">
              <div>
                <span className="section-label">
                  ORDER #{activeOrder.order_number}
                </span>
                <p className="order-status">
                  <Truck size={14} />
                  {activeOrder.status}
                </p>
              </div>
              <span className="status-dot" />
            </div>

            <div className="progress-track">
              <div
                className="progress-fill"
                style={{
                  width:
                    activeOrder.status === 'Pending'
                      ? '15%'
                      : activeOrder.status === 'Confirmed'
                        ? '30%'
                        : activeOrder.status === 'Processing'
                          ? '50%'
                          : activeOrder.status === 'Ready for Pickup'
                            ? '70%'
                            : activeOrder.status === 'Out for Delivery'
                              ? '90%'
                              : '100%',
                }}
              />
            </div>

            <p className="progress-caption">
              Pickup date: {formatDate(activeOrder.pickup_date)}
            </p>

            <button
              className="text-button"
              onClick={() => {
                setSelectedOrder(activeOrder);
                setScreen('order-details');
              }}
            >
              View order <ChevronRight size={15} />
            </button>
          </section>
        ) : (
          <section className="active-order">
            <div className="active-order-top">
              <div>
                <span className="section-label">YOUR LAUNDRY</span>
                <p className="order-status">
                  <CheckCircle2 size={14} />
                  Ready when you are!
                </p>
              </div>
              <span className="status-dot" />
            </div>
            <p className="progress-caption">
              Place an order and we'll take care of your laundry.
            </p>
          </section>
        )}

        <section className="services-section">
          <div className="section-heading">
            <div>
              <h3>Our Services</h3>
              <p>Choose your laundry service</p>
            </div>
            <button
              className="text-button"
              onClick={() => setScreen('services')}
            >
              See all <ChevronRight size={15} />
            </button>
          </div>

          <div className="services-grid">
            {renderServicesStatus()}
            {!loadingServices &&
              !servicesError &&
              services.map((service) => {
                const Icon =
                  serviceIcons[
                    String(service.icon_key || '').toLowerCase()
                  ] || Droplets;

                return (
                    <article className="service-card" key={service.id}>
                      <div className="service-image">
                        <Icon size={37} strokeWidth={1.5} />
                      </div>

                      <h4>{service.name}</h4>
                      <p>
                        {formatPrice(service.price)} / {service.unit}
                      </p>

                      <button
                        className="add-service-button"
                        onClick={() => addToCart(service)}
                      >
                        <Plus size={14} /> Add
                      </button>
                    </article>
                  );
              })}
          </div>
        </section>

        <section className="promo-banner">
          <div className="promo-icon">
            <Sparkles size={24} />
          </div>
          <div>
            <strong>First time with LabaGO?</strong>
            <p>Enjoy 10% off your first order!</p>
          </div>
        </section>

        <section className="support-section">
          <h3>Need help?</h3>
          <p>We're here to assist you with your laundry.</p>
          <div className="support-actions">
            <button onClick={() => alert('Chat support coming soon!')}>
              <MessageCircle size={16} /> Chat
            </button>
            <button onClick={() => alert('Call support coming soon!')}>
              <Phone size={16} /> Call
            </button>
          </div>
        </section>
      </>
    );
  };

  const renderServices = () => (
    <>
      {renderHeader('Our Services')}

      <p className="page-description">
        Choose the laundry service you need.
      </p>

      <div className="full-services-list">
        {renderServicesStatus()}
        {!loadingServices &&
          !servicesError &&
          services.map((service) => {
            const Icon =
              serviceIcons[String(service.icon_key || '').toLowerCase()] ||
              Droplets;

            return (
              <article className="full-service-card" key={service.id}>
                <div className="full-service-icon">
                  <Icon size={27} />
                </div>

                <div className="full-service-info">
                  <h3>{service.name}</h3>
                  <p>{service.description}</p>
                  <strong>
                    {formatPrice(service.price)} / {service.unit}
                  </strong>
                </div>

                <button
                  className="round-add-button"
                  onClick={() => addToCart(service)}
                >
                  <Plus size={19} />
                </button>
              </article>
            );
          })}
      </div>
    </>
  );

  const renderCart = () => (
    <>
      {renderHeader('My Cart')}
      {renderError()}

      {cart.length === 0 ? (
        <div className="empty-state">
          <ShoppingBag size={48} />
          <h3>Your cart is empty</h3>
          <p>Add some laundry services to get started.</p>
          <button
            className="primary-button"
            onClick={() => setScreen('services')}
          >
            Browse Services
          </button>
        </div>
      ) : (
        <>
          <p className="page-description">
            Review your selected laundry services.
          </p>

          <div className="cart-list">
            {cart.map((item) => {
              const Icon = item.icon;

              return (
                <article className="cart-item" key={item.id}>
                  <div className="cart-item-icon">
                    <Icon size={25} />
                  </div>

                  <div className="cart-item-details">
                    <h3>{item.name}</h3>
                    <p>
                      {formatPrice(item.price)} / {item.unit}
                    </p>

                    <div className="quantity-control">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        aria-label="Decrease quantity"
                      >
                        <Minus size={13} />
                      </button>

                      <span>
                        {item.quantity} {item.unit}
                      </span>

                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        aria-label="Increase quantity"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="cart-item-right">
                    <strong>
                      {formatPrice(item.price * item.quantity)}
                    </strong>
                    <button
                      className="remove-button"
                      onClick={() => removeFromCart(item.id)}
                      aria-label="Remove item"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="cart-total">
            <span>Total</span>
            <strong>{formatPrice(total)}</strong>
          </div>

          <button
            className="primary-button checkout-button"
            onClick={() => setScreen('checkout')}
          >
            Proceed to Checkout
          </button>
        </>
      )}
    </>
  );

  const renderCheckout = () => (
    <>
      {renderHeader('Checkout', 'cart')}
      {renderError()}

      <form className="checkout-form" onSubmit={handlePlaceOrder}>
        <section className="summary-card">
          <h3>Order summary</h3>

          {cart.map((item) => (
            <div className="summary-line" key={item.id}>
              <span>
                {item.name} ({item.quantity} {item.unit})
              </span>
              <strong>
                {formatPrice(item.price * item.quantity)}
              </strong>
            </div>
          ))}

          <div className="summary-divider" />

          <div className="summary-line summary-total">
            <span>Subtotal</span>
            <strong>{formatPrice(total)}</strong>
          </div>
        </section>

        <section className="form-section">
  <label htmlFor="saved-address">
    <MapPin size={16} /> Pickup Address
  </label>

  {savedAddresses.length === 0 ? (
    <div>
      <p>You don't have a saved pickup address yet.</p>
      <button
        type="button"
        className="primary-button"
        onClick={() => setScreen('addresses')}
      >
        Add Pickup Address
      </button>
    </div>
  ) : (
    <>
      <select
        id="saved-address"
        value={selectedAddressId}
        onChange={(event) => setSelectedAddressId(event.target.value)}
        required
      >
        <option value="">Select a saved address</option>

        {savedAddresses.map((item) => (
          <option value={item.id} key={item.id}>
            {item.label || 'Address'} - {item.address_line}
          </option>
        ))}
      </select>

      {selectedAddress && (
        <div className="summary-card">
          <strong>{selectedAddress.recipient_name}</strong>
          <p>{selectedAddress.phone}</p>
          <p>{getFullAddress(selectedAddress)}</p>
          {selectedAddress.instructions && (
            <p>{selectedAddress.instructions}</p>
          )}
        </div>
      )}

      <button
        type="button"
        className="text-button"
        onClick={() => setScreen('addresses')}
      >
        Manage Saved Addresses <ChevronRight size={15} />
      </button>
    </>
  )}
</section>

        <section className="form-section">
          <label htmlFor="pickup-date">
            <CalendarDays size={16} /> Date & Time
          </label>

          <input
            id="pickup-date"
            type="date"
            min={localToday}
            value={pickupDate}
            onChange={(event) => setPickupDate(event.target.value)}
            required
          />

          <div className="time-select">
            <Clock3 size={16} />
            <select
              value={pickupTime}
              onChange={(event) => setPickupTime(event.target.value)}
            >
              <option>8:00 AM - 10:00 AM</option>
              <option>10:00 AM - 12:00 PM</option>
              <option>12:00 PM - 2:00 PM</option>
              <option>2:00 PM - 4:00 PM</option>
              <option>4:00 PM - 6:00 PM</option>
            </select>
          </div>
        </section>

        <section className="form-section">
          <label>
            <CreditCard size={16} /> Payment Method
          </label>

          <div className="payment-options">
            {['Cash on pickup', 'GCash', 'Credit / debit card'].map(
              (method) => (
                <label className="payment-option" key={method}>
                  <input
                    type="radio"
                    name="payment"
                    value={method}
                    checked={payment === method}
                    onChange={(event) => setPayment(event.target.value)}
                  />
                  <span>{method}</span>
                </label>
              )
            )}
          </div>

          <p className="payment-note">
            Online payment is not active yet. Please choose "Cash on pickup" for now.
          </p>
        </section>

        <div className="checkout-total">
          <span>Total</span>
          <strong>{formatPrice(total)}</strong>
        </div>

        <button
          className="primary-button place-order-button"
          type="submit"
          disabled={placingOrder || cart.length === 0}
        >
          {placingOrder ? 'Placing Order...' : 'Place Order'}
        </button>

        <p className="checkout-help">Need help? Contact us</p>
      </form>
    </>
  );

  const renderOrders = () => (
    <>
      {renderHeader('My Orders')}

      {orderSuccess && (
        <div className="success-banner">
          <CheckCircle2 size={22} />
          <div>
            <strong>Order placed successfully!</strong>
            <p>Your order has been saved to your account.</p>
          </div>
          <button onClick={() => setOrderSuccess(false)}>×</button>
        </div>
      )}

      {renderError()}

      <div className="section-heading">
        <div>
          <h3>Order History</h3>
          <p>Your laundry orders</p>
        </div>
        <button className="text-button" onClick={loadOrders}>
          Refresh
        </button>
      </div>

      {loadingOrders ? (
        <div className="empty-state">
          <p>Loading your orders...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="empty-state">
          <ClipboardList size={48} />
          <h3>No orders yet</h3>
          <p>Your laundry orders will appear here.</p>
          <button
            className="primary-button"
            onClick={() => setScreen('home')}
          >
            Start an Order
          </button>
        </div>
      ) : (
        <div className="orders-list">
          {orders.map((order) => (
            <article className="order-card" key={order.id}>
              <div className="order-card-top">
                <div>
                  <span className="section-label">
                    ORDER #{order.order_number}
                  </span>
                  <p>{formatDate(order.pickup_date)}</p>
                </div>
                <span className="pending-badge">{order.status}</span>
              </div>

              {(order.items || []).map((item) => (
                <p className="order-item-line" key={item.id}>
                  {item.service_name} · {item.quantity} {item.unit}
                </p>
              ))}

              <div className="order-card-bottom">
                <span>Total</span>
                <strong>{formatPrice(order.total)}</strong>
              </div>

              <button
                className="text-button"
                onClick={() => {
                  setSelectedOrder(order);
                  setScreen('order-details');
                }}
              >
                View details <ChevronRight size={15} />
              </button>
            </article>
          ))}
        </div>
      )}
    </>
  );

  const renderOrderDetails = () => {
    if (!selectedOrder) {
      return (
        <>
          {renderHeader('Order Details', 'orders')}
          <div className="empty-state">
            <h3>Order not selected</h3>
            <button
              className="primary-button"
              onClick={() => setScreen('orders')}
            >
              Back to Orders
            </button>
          </div>
        </>
      );
    }

    return (
      <>
        {renderHeader('Order Details', 'orders')}

        <article className="order-card">
          <div className="order-card-top">
            <div>
              <span className="section-label">
                ORDER #{selectedOrder.order_number}
              </span>
              <p>{formatDate(selectedOrder.pickup_date)}</p>
            </div>
            <span className="pending-badge">{selectedOrder.status}</span>
          </div>

          <h3>Pickup Information</h3>
          <p>{selectedOrder.pickup_address}</p>
          <p>{selectedOrder.pickup_time}</p>

          <div className="summary-divider" />

          <h3>Services Ordered</h3>

          {(selectedOrder.items || []).map((item) => (
            <div className="summary-line" key={item.id}>
              <span>
                {item.service_name} ({item.quantity} {item.unit})
              </span>
              <strong>{formatPrice(item.line_total)}</strong>
            </div>
          ))}

          <div className="summary-divider" />

          <div className="summary-line">
            <span>Payment Method</span>
            <strong>{selectedOrder.payment_method}</strong>
          </div>

          <div className="order-card-bottom">
            <span>Total</span>
            <strong>{formatPrice(selectedOrder.total)}</strong>
          </div>
        </article>

        <section className="account-details">
          <h3>Order Tracking</h3>

          {(selectedOrder.history || []).length === 0 ? (
            <p>No tracking updates yet.</p>
          ) : (
            (selectedOrder.history || []).map((entry) => (
              <div className="account-detail-row" key={entry.id}>
                <div>
                  <strong>{entry.status}</strong>
                  <p>{entry.note || 'Status updated.'}</p>
                  <small>
                    {entry.created_at
                      ? new Date(entry.created_at).toLocaleString('en-PH')
                      : ''}
                  </small>
                </div>
              </div>
            ))
          )}
        </section>

        <button
          className="primary-button"
          onClick={loadOrders}
        >
          Refresh Tracking
        </button>
      </>
    );
  };

  const renderProfile = () => (
    <>
      {renderHeader('My Profile')}

      <div className="profile-card">
        <div className="profile-avatar">
          <UserRound size={34} />
        </div>

        <h2>{profile?.full_name || 'LabaGO Customer'}</h2>
        <p>{user?.email}</p>

        <span className="profile-role">
          {role === 'admin' ? 'Administrator' : 'Customer'}
        </span>
      </div>

      <div className="account-details">
        <h3>Account Information</h3>

        <div className="account-detail-row">
          <span>Full Name</span>
          <strong>{profile?.full_name || 'Not provided'}</strong>
        </div>

        <div className="account-detail-row">
          <span>Email Address</span>
          <strong>{user?.email}</strong>
        </div>

        <div className="account-detail-row">
          <span>Phone Number</span>
          <strong>{profile?.phone || 'Not provided'}</strong>
        </div>

        <div className="account-detail-row">
          <span>Account Type</span>
          <strong>
            {role === 'admin' ? 'Administrator' : 'Customer'}
          </strong>
        </div>
      </div>

      <div className="profile-options">
        <button onClick={() => alert('Profile editing coming soon!')}>
          Edit Profile <ChevronRight size={18} />
        </button>

        {!isInstalled && (
  <button
    type="button"
    onClick={async () => {
      if (canInstall) {
        await installApp();
      } else {
        alert(
          'To install LabaGO:\n\n' +
            '• Android (Chrome): Tap ⋮ → "Install app".\n' +
            '• iPhone (Safari): Tap Share → "Add to Home Screen".\n' +
            '• Desktop (Chrome / Edge): Click the Install icon in the address bar.'
        );
      }
    }}
  >
    Download LabaGO App <ChevronRight size={18} />
  </button>
)}

        <button onClick={() => {
          setErrorMessage('');
            loadAddresses();
            setScreen('addresses');
              }}>
                  Saved Addresses <ChevronRight size={18} />
                </button>

        <button onClick={() => alert('Help center coming soon!')}>
          Help & Support <ChevronRight size={18} />
        </button>

        <button onClick={() => alert('LabaGO version 1.0.0')}>
          About LabaGO <ChevronRight size={18} />
        </button>
      </div>

      <button className="logout-button" onClick={onSignOut}>
        Sign Out
      </button>
    </>
  );

  return (
    <div className="app-background">
      <div className="app-shell">
        <div className="app-brand">
          <Droplets size={23} />
          <span>LabaGO</span>
          <small>LAUNDRY PICK-UP & DELIVERY</small>
        </div>

        <main className="app-content">
          {screen === 'home' && renderHome()}
          {screen === 'services' && renderServices()}
          {screen === 'cart' && renderCart()}
          {screen === 'checkout' && renderCheckout()}
          {screen === 'orders' && renderOrders()}
          {screen === 'order-details' && renderOrderDetails()}
          {screen === 'profile' && renderProfile()}
          {screen === 'addresses' && renderAddresses()}
          {screen === 'address-form' && renderAddressForm()}
        </main>

        <nav className="bottom-navigation">
          <button
            className={
              screen === 'home' || screen === 'services' ? 'active' : ''
            }
            onClick={() => setScreen('home')}
          >
            <House size={20} />
            <span>Home</span>
          </button>

          <button
            className={screen === 'orders' || screen === 'order-details' ? 'active' : ''}
            onClick={() => {
              setOrderSuccess(false);
              setScreen('orders');
            }}
          >
            <ClipboardList size={20} />
            <span>Orders</span>
          </button>

          <button
            className={
              screen === 'cart' || screen === 'checkout' ? 'active' : ''
            }
            onClick={() => setScreen('cart')}
          >
            <div className="nav-icon-wrapper">
              <ShoppingBag size={20} />
              {totalItems > 0 && (
                <span className="cart-badge">{totalItems}</span>
              )}
            </div>
            <span>Cart</span>
          </button>

          <button
            className={screen === 'profile' ? 'active' : ''}
            onClick={() => setScreen('profile')}
          >
            <UserRound size={20} />
            <span>Profile</span>
          </button>
        </nav>
      </div>
    </div>
  );
}

export default App;
