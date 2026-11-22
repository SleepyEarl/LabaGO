
import { supabase } from '../supabaseClient';


export async function getServices() {
  const { data, error } = await supabase
    .from('services')
    .select('id, name, description, price, unit, icon_key')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);

  return data || [];
}



export async function placeOrder({
  customerId,
  address,
  pickupDate,
  pickupTime,
  paymentMethod,
  items,
}) {
  const orderItems = items.map((item) => ({
    service_id: item.id,
    quantity: Number(item.quantity),
  }));

  const { data, error } = await supabase.rpc('place_laundry_order', {
    p_customer_id: customerId,
    p_pickup_address: address.trim(),
    p_pickup_date: pickupDate,
    p_pickup_time: pickupTime,
    p_payment_method: paymentMethod,
    p_items: orderItems,
  });

  if (error) throw new Error(error.message);

  return data;
}

export async function getCustomerOrders(customerId) {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      order_items (*),
      order_status_history (*)
    `)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data || []).map((order) => ({
    ...order,
    items: order.order_items || [],
    history: (order.order_status_history || []).sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at)
    ),
  }));
}
