// ==================== FIX PARA CATERING.HTML ====================
// Agregar este código al archivo catering.html para corregir el error de actualización de estado

// Esta función debe reemplazar la función existente de actualizar estado
async function actualizarEstadoCatering(id, nuevoEstado) {
  try {
    // Actualizar en la tabla reservas_catering
    const { error } = await supabase
      .from('reservas_catering')
      .update({ 
        estado: nuevoEstado.toLowerCase(),
        actualizado_en: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;

    // Mostrar mensaje de éxito
    alert(`✅ Estado actualizado a: ${nuevoEstado}`);
    
    // Recargar la tabla
    await cargarReservas();
    
  } catch (error) {
    console.error('Error al actualizar estado:', error);
    alert('❌ Error al actualizar el estado del catering');
  }
}

// Esta función debe reemplazar la función existente de eliminar catering
async function eliminarCatering(id) {
  if (!confirm('¿Estás seguro de eliminar esta reserva de catering?')) {
    return;
  }

  try {
    const { error } = await supabase
      .from('reservas_catering')
      .delete()
      .eq('id', id);

    if (error) throw error;

    alert('✅ Reserva de catering eliminada');
    await cargarReservas();
    
  } catch (error) {
    console.error('Error al eliminar:', error);
    alert('❌ Error al eliminar la reserva de catering');
  }
}