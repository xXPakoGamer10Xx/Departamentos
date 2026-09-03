import React from 'react';
import { Document, Page, View, Text as PdfText, StyleSheet } from '@react-pdf/renderer';

interface ContratoProps {
  data: {
    nombre_completo: string;
    depto_numero: number;
    renta: number;
    renta_letra: string;
    fecha_pago: string;
    fecha_inicio: string;
    fecha_termino: string;
    fiador_nombre: string | null;
    tel_arrendatario: string | null;
    fiador_telefono: string | null;
    observaciones: string | null;
    inventario: string[];
    inventario_base: string[];
    arrendador_nombre: string;
    arrendador_direccion: string;
    deposito: number | null;
    deposito_tipo: string | null;
    deposito_fechas: string[] | null;
    metodo_pago: string | null;
  };
}

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    paddingTop: 50,
    paddingBottom: 60,
    paddingHorizontal: 55,
    lineHeight: 1.5,
    color: '#000',
  },
  title: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  dateRight: {
    fontSize: 10,
    textAlign: 'right',
    marginBottom: 16,
  },
  paragraph: {
    marginBottom: 10,
    textAlign: 'justify',
  },
  bold: {
    fontFamily: 'Helvetica-Bold',
  },
  clauseTitle: {
    fontFamily: 'Helvetica-Bold',
    marginTop: 10,
    marginBottom: 4,
    textDecoration: 'underline',
  },
  clauseItem: {
    marginBottom: 8,
    textAlign: 'justify',
  },
  inventoryTitle: {
    fontFamily: 'Helvetica-Bold',
    marginTop: 14,
    marginBottom: 6,
    textAlign: 'center',
    fontSize: 11,
    textDecoration: 'underline',
  },
  inventoryItem: {
    marginBottom: 3,
    marginLeft: 10,
  },
  signaturesSection: {
    marginTop: 40,
  },
  signatureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  signatureBlock: {
    width: '45%',
    alignItems: 'center',
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    width: '90%',
    marginBottom: 4,
  },
  signatureLabel: {
    fontSize: 9,
    textAlign: 'center',
  },
  signatureName: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
  },
  signaturePhone: {
    fontSize: 9,
    textAlign: 'center',
  },
  fiadorSection: {
    marginTop: 24,
  },
  observaciones: {
    marginTop: 12,
    fontSize: 9,
    fontFamily: 'Helvetica-Oblique',
  },
  divider: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#888',
    marginVertical: 10,
  },
});

function formatFecha(fechaStr: string): string {
  if (!fechaStr) return '';
  const d = new Date(fechaStr);
  return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase();
}

function formatMoneda(monto: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(monto);
}

export function ContratoArrendamiento({ data }: ContratoProps) {
  const {
    nombre_completo,
    depto_numero,
    renta,
    renta_letra,
    fecha_pago,
    fecha_inicio,
    fecha_termino,
    fiador_nombre,
    tel_arrendatario,
    fiador_telefono,
    observaciones,
    arrendador_nombre,
    arrendador_direccion,
    deposito,
    deposito_tipo,
    deposito_fechas,
    metodo_pago,
  } = data;

  const hoy = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase();
  const fechaInicioStr = formatFecha(fecha_inicio);
  const fechaTerminoStr = formatFecha(fecha_termino);
  const rentalAmount = formatMoneda(Number(renta));
  const arrendadorUpper = arrendador_nombre.toUpperCase();
  const arrendatarioUpper = nombre_completo.toUpperCase();
  const fiadorUpper = fiador_nombre ? fiador_nombre.toUpperCase() : '';

  const metodoPagoLabel = metodo_pago === 'transferencia'
    ? 'transferencia bancaria'
    : metodo_pago === 'ambos'
    ? 'efectivo o transferencia bancaria'
    : 'efectivo';

  const depositoParrafo = deposito && Number(deposito) > 0
    ? (() => {
        const depositoAmount = formatMoneda(Number(deposito));
        if (deposito_tipo === 'quincenas' || deposito_tipo === 'personalizado') {
          const fechasStr = Array.isArray(deposito_fechas) && deposito_fechas.length > 0
            ? deposito_fechas.map(formatFecha).join(', ')
            : '';
          return `El arrendatario entregará un depósito en garantía de ${depositoAmount}, pagadero en ${metodoPagoLabel}, en abonos diferidos con vencimiento en las siguientes fechas: ${fechasStr}, con el carácter y los efectos previstos en la cláusula de pena convencional y gastos de restitución.`;
        }
        return `El arrendatario entregará un depósito en garantía de ${depositoAmount}, pagadero en ${metodoPagoLabel} al inicio del presente contrato, con el carácter y los efectos previstos en la cláusula de pena convencional y gastos de restitución.`;
      })()
    : null;

  const inventarioItems: string[] =
    Array.isArray(data.inventario) && data.inventario.length > 0
      ? data.inventario
      : Array.isArray(data.inventario_base) && data.inventario_base.length > 0
      ? data.inventario_base
      : [];

  const clauses = [
    `Conviene expresamente el arrendatario, que todo mes será pagado integro aun cuando no se use, más que por un día.`,
    `El arrendamiento será de ${rentalAmount} mensual (${renta_letra.toUpperCase()}).`,
    `Al terminar el tiempo por el que ha sido contratado el arrendamiento, el arrendatario se obliga a desocupar el departamento y si por circunstancias determinadas no pudiera hacerlo, se obliga a pagar la cantidad ${rentalAmount}, equivalente a un mes hasta que lo desocupen o firmen nuevo contrato.`,
    `Esta prohibido al arrendatario, subarrendar, traspasar o ceder sus derechos de inquilino a cualquier persona.`,
    `El Arrendatario no podrá usar el departamento, más que para Vivienda, descanso, aseo personal. Y bajo ninguna circunstancia para uso comercial como: Vender alimentos, bebidas, sustancias prohibidas por mencionar algunos; es exclusivo para uso personal.`,
    `El arrendatario hace expreso reconocimiento, de que la habitación motivo de este contrato lo recibe a su entera satisfacción en perfecto estado de conservación y aseo, con sus instalaciones sanitarias y de electricidad doméstica completas y en condiciones normales de servicio, comprometiéndose a conservarlas en igual estado, haciendo por su cuenta las reparaciones como cambio de llaves, focos, mangueras que se hayan deteriorado que se originen en los servicios a que se refiere esta cláusula, hasta devolver el local con solo natural deterioro de uso correcto.`,
    `Toda clase de mejoras, ya sean útiles o necesarias, serán por cuenta del arrendatario, sin que pueda retirarlas al desocuparlo, ni exigir pago o indemnización por ellas.`,
    `Las mensualidades de renta serán pagadas íntegras, hasta que el arrendatario entregue el departamento de conformidad con lo dispuesto en el artículo 2283 del código Civil citado, no pudiendo retener por ningún motivo que el mandato de la autoridad judicial.`,
    fiador_nombre
      ? `Para garantía del cumplimiento de este contrato, lo firma mancomunadamente ${fiadorUpper} como fiador, haciendo solidario de las obligaciones del arrendatario: ${arrendatarioUpper}. Hasta la fecha en que el departamento haya sido recibido de conformidad por el arrendador, a cuyo fin el fiador renuncia las disposiciones contenidas en el capítulo II del Título décimo tercero del repetido Código Civil.`
      : `El arrendatario garantiza el cumplimiento de este contrato con todos los bienes que integran su patrimonio.`,
    `Es importante que al dejar el departamento se avise con un mínimo de 15 días de anticipación. La falta de este aviso se considera incumplimiento para todos los efectos de este contrato.`,
    `Pena convencional y gastos de restitución. Las partes convienen que la suma entregada al inicio de este contrato tiene carácter de garantía de cumplimiento y acondicionamiento final, por lo que en ningún caso habrá devolución de dinero en efectivo ni podrá aplicarse como pago de mensualidades ordinarias de renta. En caso de desocupación anticipada o incumplimiento por parte del arrendatario, dicha cantidad quedará íntegramente a favor del arrendador como pena convencional. Al vencimiento natural del contrato, dicha suma se destinará a cubrir los gastos de pintura, mantenimiento y restauración del inmueble para devolverlo a su estado original, no existiendo saldo remanente exigible de devolución.`,
    `Se anexan Normas de Convivencia: Mantener limpio el espacio del Depto. Evitar reuniones de más de 2 personas en horarios de descanso. No mascotas. Notificar oportunamente cualquier falla para poder solucionarla y determinar quién es responsable del pago. Formar parte de una comunidad con respeto. Evitar visitas en estado de ebriedad. En caso de ausencia evidente y prolongada sin comunicación previa, el arrendador podrá confirmar la continuación de la ocupación. No prestar llaves a terceras personas. Cuidar las salidas y entradas cerrando bien las puertas. El uso del lavadero es para toda la comunidad; úsalo con responsabilidad, retira tu ropa el mismo día, horario hasta las 6 pm.`,
  ];

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <PdfText style={styles.title}>Contrato de Arrendatario</PdfText>
        <PdfText style={styles.dateRight}>{hoy}</PdfText>

        <PdfText style={styles.paragraph}>
          Que de conformidad con lo dispuesto por el Artículo 2260 del código Civil vigente en el Estado de México,
          formalizan, por su propio derecho como Arrendador{' '}
          <PdfText style={styles.bold}>{arrendadorUpper}</PdfText>
          {' '}y como Arrendatario{' '}
          <PdfText style={styles.bold}>{arrendatarioUpper}</PdfText>
          , sujetándose a las siguientes, CLAUSULAS:
        </PdfText>

        <PdfText style={styles.paragraph}>
          La Sra. <PdfText style={styles.bold}>{arrendadorUpper}</PdfText> da en arrendamiento. Y la Sr(a).{' '}
          <PdfText style={styles.bold}>{arrendatarioUpper}</PdfText> lo recibe como arrendatario, el Departamento NO.{' '}
          <PdfText style={styles.bold}>{depto_numero}</PdfText> Ubicado en:{' '}
          <PdfText style={styles.bold}>{arrendador_direccion}</PdfText>.
        </PdfText>

        <PdfText style={styles.paragraph}>
          El arrendatario pagará a la arrendadora a quien sus derechos representan, la suma de{' '}
          <PdfText style={styles.bold}>{rentalAmount}</PdfText> los días{' '}
          <PdfText style={styles.bold}>{fecha_pago.toUpperCase()}</PdfText>, en moneda nacional de curso legal por
          mensualidad adelantada y dentro de los cinco días que corresponda acuerdo con el contrato establecido,
          precisar en el domicilio del arrendador.
        </PdfText>

        {depositoParrafo ? (
          <PdfText style={styles.paragraph}>{depositoParrafo}</PdfText>
        ) : null}

        <PdfText style={styles.paragraph}>
          El presente contrato da inicio el{' '}
          <PdfText style={styles.bold}>{fechaInicioStr}</PdfText>
          {' '}y vence el{' '}
          <PdfText style={styles.bold}>{fechaTerminoStr}</PdfText>.
        </PdfText>

        {clauses.map((text, i) => (
          <PdfText key={i} style={styles.clauseItem}>
            <PdfText style={styles.bold}>{i + 1}.- </PdfText>
            {text}
          </PdfText>
        ))}

        {inventarioItems.length > 0 && (
          <View>
            <PdfText style={styles.inventoryTitle}>INVENTARIO</PdfText>
            {inventarioItems.map((item, i) => (
              <PdfText key={i} style={styles.inventoryItem}>• {typeof item === 'string' ? item : String(item)}</PdfText>
            ))}
          </View>
        )}

        {observaciones ? (
          <PdfText style={styles.observaciones}>Observaciones: {observaciones}</PdfText>
        ) : null}

        <View style={styles.signaturesSection} wrap={false}>
          <View style={styles.signatureRow}>
            <View style={styles.signatureBlock}>
              <View style={styles.signatureLine} />
              <PdfText style={styles.signatureName}>{arrendatarioUpper}</PdfText>
              {tel_arrendatario ? (
                <PdfText style={styles.signaturePhone}>Tel: {tel_arrendatario}</PdfText>
              ) : null}
              <PdfText style={styles.signatureLabel}>Arrendatario</PdfText>
            </View>
            <View style={styles.signatureBlock}>
              <View style={styles.signatureLine} />
              <PdfText style={styles.signatureName}>{arrendadorUpper}</PdfText>
              <PdfText style={styles.signatureLabel}>Arrendadora</PdfText>
            </View>
          </View>

          {fiador_nombre && (
            <View style={styles.fiadorSection}>
              <View style={styles.signatureRow}>
                <View style={styles.signatureBlock}>
                  <View style={styles.signatureLine} />
                  <PdfText style={styles.signatureName}>{fiadorUpper}</PdfText>
                  {fiador_telefono ? (
                    <PdfText style={styles.signaturePhone}>Tel: {fiador_telefono}</PdfText>
                  ) : null}
                  <PdfText style={styles.signatureLabel}>Fiador</PdfText>
                </View>
                <View style={[styles.signatureBlock, { justifyContent: 'flex-end', paddingTop: 2 }]}>
                  <PdfText style={[styles.signatureName, { textAlign: 'center' }]}>{fechaInicioStr}</PdfText>
                </View>
              </View>
            </View>
          )}
        </View>
      </Page>
    </Document>
  );
}
