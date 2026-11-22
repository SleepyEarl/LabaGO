
import { supabase } from '../supabaseClient';

export async function getCustomerAddresses(customerId) {
  const { data, error } = await supabase
    .from('addresses')
    .select('*')
    .eq('customer_id', customerId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return data || [];
}

export async function addAddress(customerId, address) {
  if (address.is_default) {
    const { error: resetError } = await supabase
      .from('addresses')
      .update({ is_default: false })
      .eq('customer_id', customerId);

    if (resetError) throw new Error(resetError.message);
  }

  const { data, error } = await supabase
    .from('addresses')
    .insert({
      customer_id: customerId,
      label: address.label,
      recipient_name: address.recipient_name,
      phone: address.phone,
      address_line: address.address_line,
      barangay: address.barangay || null,
      city: address.city,
      province: address.province || null,
      postal_code: address.postal_code || null,
      instructions: address.instructions || null,
      is_default: Boolean(address.is_default),
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  return data;
}

export async function updateAddress(customerId, addressId, address) {
  if (address.is_default) {
    const { error: resetError } = await supabase
      .from('addresses')
      .update({ is_default: false })
      .eq('customer_id', customerId);

    if (resetError) throw new Error(resetError.message);
  }

  const { data, error } = await supabase
    .from('addresses')
    .update({
      label: address.label,
      recipient_name: address.recipient_name,
      phone: address.phone,
      address_line: address.address_line,
      barangay: address.barangay || null,
      city: address.city,
      province: address.province || null,
      postal_code: address.postal_code || null,
      instructions: address.instructions || null,
      is_default: Boolean(address.is_default),
    })
    .eq('id', addressId)
    .eq('customer_id', customerId)
    .select()
    .single();

  if (error) throw new Error(error.message);

  return data;
}

export async function deleteAddress(customerId, addressId) {
  const { error } = await supabase
    .from('addresses')
    .delete()
    .eq('id', addressId)
    .eq('customer_id', customerId);

  if (error) throw new Error(error.message);
}

export async function setDefaultAddress(customerId, addressId) {
  const { error: resetError } = await supabase
    .from('addresses')
    .update({ is_default: false })
    .eq('customer_id', customerId);

  if (resetError) throw new Error(resetError.message);

  const { error } = await supabase
    .from('addresses')
    .update({ is_default: true })
    .eq('id', addressId)
    .eq('customer_id', customerId);

  if (error) throw new Error(error.message);
}
