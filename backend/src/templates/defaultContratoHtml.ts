/**
 * Contrato de arrendamiento por defecto, en HTML con {{variables}}.
 *
 * Es el mismo texto que renderiza ContratoArrendamiento.tsx, pero como HTML
 * editable. Se usa como semilla cuando el admin abre el editor de contrato
 * (global o por inquilino) y todavía no hay una plantilla propia.
 *
 * IMPORTANTE: mantener sincronizado con frontend/components/ui/contractVariables.ts
 * (DEFAULT_CONTRATO_HTML). Las variables deben existir en PdfService.buildDocxVars.
 */
export const DEFAULT_CONTRATO_HTML = `<h1>CONTRATO DE ARRENDATARIO</h1>
<p><strong>{{fecha_actual}}</strong></p>

<p>Que de conformidad con lo dispuesto por el Artículo 2260 del código Civil vigente en el Estado de México, formalizan, por su propio derecho como Arrendador <strong>{{arrendador_nombre}}</strong> y como Arrendatario <strong>{{nombre_completo}}</strong>, sujetándose a las siguientes, CLAUSULAS:</p>

<p>La Sra. <strong>{{arrendador_nombre}}</strong> da en arrendamiento. Y la Sr(a). <strong>{{nombre_completo}}</strong> lo recibe como arrendatario, el Departamento NO. <strong>{{depto_numero}}</strong> Ubicado en: <strong>{{arrendador_direccion}}</strong>.</p>

<p>El arrendatario pagará a la arrendadora a quien sus derechos representan, la suma de <strong>{{renta}}</strong> los días <strong>{{fecha_pago}}</strong>, en moneda nacional de curso legal por mensualidad adelantada y dentro de los cinco días que corresponda acuerdo con el contrato establecido, precisar en el domicilio del arrendador.</p>

<p>El arrendatario entregará un depósito en garantía de <strong>{{deposito}}</strong>, pagadero en {{metodo_pago}} al inicio del presente contrato, con el carácter y los efectos previstos en la cláusula de pena convencional y gastos de restitución.</p>

<p>El presente contrato da inicio el <strong>{{fecha_inicio}}</strong> y vence el <strong>{{fecha_termino}}</strong>.</p>

<p><strong>1.-</strong> Conviene expresamente el arrendatario, que todo mes será pagado integro aun cuando no se use, más que por un día.</p>

<p><strong>2.-</strong> El arrendamiento será de <strong>{{renta}}</strong> mensual ({{renta_letra}}).</p>

<p><strong>3.-</strong> Al terminar el tiempo por el que ha sido contratado el arrendamiento, el arrendatario se obliga a desocupar el departamento y si por circunstancias determinadas no pudiera hacerlo, se obliga a pagar la cantidad <strong>{{renta}}</strong>, equivalente a un mes hasta que lo desocupen o firmen nuevo contrato.</p>

<p><strong>4.-</strong> Esta prohibido al arrendatario, subarrendar, traspasar o ceder sus derechos de inquilino a cualquier persona.</p>

<p><strong>5.-</strong> El Arrendatario no podrá usar el departamento, más que para Vivienda, descanso, aseo personal. Y bajo ninguna circunstancia para uso comercial como: Vender alimentos, bebidas, sustancias prohibidas por mencionar algunos; es exclusivo para uso personal.</p>

<p><strong>6.-</strong> El arrendatario hace expreso reconocimiento, de que la habitación motivo de este contrato lo recibe a su entera satisfacción en perfecto estado de conservación y aseo, con sus instalaciones sanitarias y de electricidad doméstica completas y en condiciones normales de servicio, comprometiéndose a conservarlas en igual estado, haciendo por su cuenta las reparaciones como cambio de llaves, focos, mangueras que se hayan deteriorado que se originen en los servicios a que se refiere esta cláusula, hasta devolver el local con solo natural deterioro de uso correcto.</p>

<p><strong>7.-</strong> Toda clase de mejoras, ya sean útiles o necesarias, serán por cuenta del arrendatario, sin que pueda retirarlas al desocuparlo, ni exigir pago o indemnización por ellas.</p>

<p><strong>8.-</strong> Las mensualidades de renta serán pagadas íntegras, hasta que el arrendatario entregue el departamento de conformidad con lo dispuesto en el artículo 2283 del código Civil citado, no pudiendo retener por ningún motivo que el mandato de la autoridad judicial.</p>

<p><strong>9.-</strong> El arrendatario garantiza el cumplimiento de este contrato con todos los bienes que integran su patrimonio. En caso de existir fiador, este firma mancomunada y solidariamente las obligaciones del arrendatario hasta la fecha en que el departamento haya sido recibido de conformidad por el arrendador.</p>

<p><strong>10.-</strong> Es importante que al dejar el departamento se avise con un mínimo de 15 días de anticipación. La falta de este aviso se considera incumplimiento para todos los efectos de este contrato.</p>

<p><strong>11.-</strong> Pena convencional y gastos de restitución. Las partes convienen que la suma entregada al inicio de este contrato tiene carácter de garantía de cumplimiento y acondicionamiento final, por lo que en ningún caso habrá devolución de dinero en efectivo ni podrá aplicarse como pago de mensualidades ordinarias de renta. En caso de desocupación anticipada o incumplimiento por parte del arrendatario, dicha cantidad quedará íntegramente a favor del arrendador como pena convencional. Al vencimiento natural del contrato, dicha suma se destinará a cubrir los gastos de pintura, mantenimiento y restauración del inmueble para devolverlo a su estado original, no existiendo saldo remanente exigible de devolución.</p>

<p><strong>12.-</strong> Se anexan Normas de Convivencia: Mantener limpio el espacio del Depto. Evitar reuniones de más de 2 personas en horarios de descanso. No mascotas. Notificar oportunamente cualquier falla para poder solucionarla y determinar quién es responsable del pago. Formar parte de una comunidad con respeto. Evitar visitas en estado de ebriedad. En caso de ausencia evidente y prolongada sin comunicación previa, el arrendador podrá confirmar la continuación de la ocupación. No prestar llaves a terceras personas. Cuidar las salidas y entradas cerrando bien las puertas. El uso del lavadero es para toda la comunidad; úsalo con responsabilidad, retira tu ropa el mismo día, horario hasta las 6 pm.</p>

<h2>INVENTARIO</h2>
<p>{{inventario}}</p>

<h2>OBSERVACIONES</h2>
<p>{{observaciones}}</p>

<p>Leído el presente contrato y enteradas las partes de su contenido, lo firman de conformidad.</p>
<p><strong>{{arrendatario_linea}}</strong></p>
<p><strong>{{arrendador_linea}}</strong></p>
<p><strong>{{fiador_linea}}</strong></p>`;
