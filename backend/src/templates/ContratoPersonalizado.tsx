import React from 'react';
import { Document, Page, View, Text as PdfText, StyleSheet } from '@react-pdf/renderer';

export type TextSegment = { text: string; bold?: boolean; italic?: boolean };
export type ParsedPara  = { segments: TextSegment[]; level: 'p' | 'h1' | 'h2' | 'h3' };

interface Props {
  paragraphs: ParsedPara[];
  data: {
    nombre_completo: string;
    arrendador_nombre: string;
  };
}

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    paddingTop: 50,
    paddingBottom: 70,
    paddingHorizontal: 55,
    lineHeight: 1.6,
    color: '#000',
  },
  p: {
    marginBottom: 8,
    textAlign: 'justify',
  },
  h1: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  h2: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginTop: 10,
    marginBottom: 5,
    textDecoration: 'underline',
  },
  h3: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginTop: 8,
    marginBottom: 4,
  },
  bold: {
    fontFamily: 'Helvetica-Bold',
  },
  italic: {
    fontFamily: 'Helvetica-Oblique',
  },
  signaturesSection: {
    marginTop: 50,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  signatureBlock: {
    width: '38%',
    alignItems: 'center',
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    width: '100%',
    marginBottom: 5,
    paddingTop: 30,
  },
  signatureLabel: {
    fontSize: 9,
    textAlign: 'center',
    color: '#333',
  },
  pageNum: {
    position: 'absolute',
    bottom: 28,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 8,
    color: '#777',
  },
});

export function ContratoPersonalizado({ paragraphs, data }: Props) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>

        {paragraphs.map((para, i) => {
          const paraStyle = styles[para.level] ?? styles.p;
          return (
            <PdfText key={i} style={paraStyle}>
              {para.segments.map((seg, j) => (
                <PdfText
                  key={j}
                  style={seg.bold ? styles.bold : seg.italic ? styles.italic : undefined}
                >
                  {seg.text}
                </PdfText>
              ))}
            </PdfText>
          );
        })}

        {/* Firmas */}
        <View style={styles.signaturesSection}>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <PdfText style={styles.signatureLabel}>
              {'ARRENDADOR\n'}
              {data.arrendador_nombre}
            </PdfText>
          </View>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <PdfText style={styles.signatureLabel}>
              {'ARRENDATARIO\n'}
              {data.nombre_completo}
            </PdfText>
          </View>
        </View>

        <PdfText
          style={styles.pageNum}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}
