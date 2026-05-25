import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import { ContratoArrendamiento } from '../templates/ContratoArrendamiento';

export class PdfService {
  /**
   * Generates a PDF buffer from the provided contract data
   * @param data The contract data to render
   * @returns A Promise resolving to a Buffer containing the PDF
   */
  static async generateContratoPdf(data: any): Promise<Buffer> {
    const element = React.createElement(ContratoArrendamiento, { data });
    // @ts-ignore
    return await renderToBuffer(element);
  }
}
