// Variables disponibles para la plantilla de contrato. Deben coincidir con las
// que el backend reemplaza en PdfService.buildDocxVars.
export interface ContractVar { key: string; label: string }

// Plantilla base para empezar a editar un contrato desde cero (sin subir Word).
// Usa las mismas {{variables}} que reemplaza el backend al generar el PDF.
export const DEFAULT_CONTRATO_HTML = `<h1>CONTRATO DE ARRENDAMIENTO</h1>
<p>En la ciudad, siendo el {{fecha_inicio}}, celebran el presente contrato de arrendamiento por una parte <strong>{{arrendador_nombre}}</strong> como <strong>ARRENDADOR</strong>, y por la otra <strong>{{nombre_completo}}</strong> como <strong>ARRENDATARIO</strong>, respecto del inmueble ubicado en {{arrendador_direccion}}, departamento número {{depto_numero}}.</p>

<h2>PRIMERA. RENTA</h2>
<p>El ARRENDATARIO pagará una renta mensual de <strong>{{renta}}</strong> ({{renta_letra}}), pagadera el día {{fecha_pago}} mediante {{metodo_pago}}.</p>

<h2>SEGUNDA. DEPÓSITO</h2>
<p>El ARRENDATARIO entrega la cantidad de <strong>{{deposito}}</strong> en garantía, la cual será devuelta al término del contrato si el inmueble se entrega en buenas condiciones.</p>

<h2>TERCERA. VIGENCIA</h2>
<p>El presente contrato tendrá vigencia del {{fecha_inicio}} al {{fecha_termino}}.</p>

<h2>CUARTA. INVENTARIO</h2>
<p>El inmueble se entrega con el siguiente inventario: {{inventario}}.</p>

<h2>QUINTA. OBSERVACIONES</h2>
<p>{{observaciones}}</p>

<p>Leído el presente contrato y enteradas las partes de su contenido, lo firman de conformidad.</p>
<p><strong>ARRENDADOR:</strong> {{arrendador_nombre}}</p>
<p><strong>ARRENDATARIO:</strong> {{nombre_completo}} — Tel: {{tel_arrendatario}}</p>
<p><strong>FIADOR:</strong> {{fiador_nombre}} — Tel: {{fiador_telefono}}</p>`;

export const CONTRACT_VARS: ContractVar[] = [
  { key: 'nombre_completo',     label: 'Nombre inquilino' },
  { key: 'depto_numero',        label: 'N° departamento' },
  { key: 'renta',               label: 'Renta ($)' },
  { key: 'renta_letra',         label: 'Renta (letra)' },
  { key: 'deposito',            label: 'Depósito ($)' },
  { key: 'fecha_inicio',        label: 'Fecha inicio' },
  { key: 'fecha_termino',       label: 'Fecha término' },
  { key: 'fecha_pago',          label: 'Día de pago' },
  { key: 'tel_arrendatario',    label: 'Tel. inquilino' },
  { key: 'fiador_nombre',       label: 'Fiador' },
  { key: 'fiador_telefono',     label: 'Tel. fiador' },
  { key: 'arrendador_nombre',   label: 'Arrendador' },
  { key: 'arrendador_direccion',label: 'Dirección' },
  { key: 'metodo_pago',         label: 'Forma de pago' },
  { key: 'observaciones',       label: 'Observaciones' },
  { key: 'inventario',          label: 'Inventario' },
];
