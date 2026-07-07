import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import { formatInvoiceDate } from "@/lib/invoiceFormat";
import { resolveTemplateConfig } from "@/lib/invoiceTemplates";

const PLACEHOLDER = "—";
const DARK_BG_HEX = ["#000000", "#0f3057", "#7c3aed"];
const safe = (v, fb = PLACEHOLDER) => (v == null || v === "" ? fb : v);
const fmtAmount = (n, currency = "") =>
  `${currency} ${Number(n || 0).toFixed(2)}`.trim();

function buildStyles(config) {
  const { colors, layout } = config;
  const cornerRadius = Number.parseInt(String(layout.cornerRadius)) || 0;

  return StyleSheet.create({
    page: {
      fontSize: 11,
      fontFamily: "Helvetica",
      color: colors.text,
      backgroundColor: colors.background,
      paddingTop: 30,
      paddingBottom: 30,
      paddingHorizontal: 40,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerBanner: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      backgroundColor: colors.headerBg,
      borderRadius: cornerRadius,
      padding: 24,
      marginBottom: 16,
    },
    companyBlock: {
      flexDirection: "column",
    },
    companyName: {
      fontSize: 16,
      fontFamily: "Helvetica-Bold",
      color: colors.text,
    },
    companyNameInverted: {
      fontSize: 16,
      fontFamily: "Helvetica-Bold",
      color: colors.headerText,
    },
    companyDetail: {
      fontSize: 9,
      color: colors.textMuted,
      marginTop: 2,
    },
    companyDetailInverted: {
      fontSize: 9,
      color: colors.headerText,
      marginTop: 2,
      opacity: 0.85,
    },
    logo: {
      width: 50,
      height: 50,
      objectFit: "contain",
      borderRadius: 6,
      marginRight: 12,
    },
    logoInverted: {
      width: 50,
      height: 50,
      objectFit: "contain",
      borderRadius: 6,
      marginRight: 12,
      backgroundColor: "#ffffff",
      padding: 4,
    },
    titleBlock: {
      alignItems: "flex-end",
    },
    title: {
      fontSize: 24,
      fontFamily: "Helvetica-Bold",
      color: colors.primary,
      lineHeight: 1.1,
    },
    titleInverted: {
      fontSize: 24,
      fontFamily: "Helvetica-Bold",
      color: colors.headerText,
      lineHeight: 1.1,
    },
    invoiceNumber: {
      fontSize: 11,
      color: colors.primary,
      marginTop: 4,
    },
    invoiceNumberInverted: {
      fontSize: 11,
      color: colors.headerText,
      marginTop: 4,
      opacity: 0.85,
    },
    metaSection: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingTop: 20,
      paddingBottom: 20,
    },
    metaLabel: {
      fontSize: 9,
      fontFamily: "Helvetica-Bold",
      color: colors.textMuted,
      marginBottom: 6,
      letterSpacing: 1,
    },
    metaClientName: {
      fontSize: 14,
      fontFamily: "Helvetica-Bold",
      color: colors.text,
    },
    metaClientEmail: {
      fontSize: 10,
      color: colors.textMuted,
      marginTop: 2,
    },
    metaDetail: {
      fontSize: 11,
      color: colors.text,
      lineHeight: 1.6,
    },
    tableHeader: {
      flexDirection: "row",
      backgroundColor: colors.tableHeaderBg,
      borderRadius: cornerRadius,
    },
    tableHeaderCell: {
      padding: 8,
      fontSize: 9,
      fontFamily: "Helvetica-Bold",
      color: colors.tableHeaderText,
      letterSpacing: 1,
    },
    tableRow: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tableRowStriped: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.accent,
    },
    tableCell: {
      padding: 8,
      fontSize: 11,
      color: colors.text,
    },
    colDescription: { flex: 1 },
    colNum: { width: 60, textAlign: "right" },
    colPrice: { width: 90, textAlign: "right" },
    colAmount: { width: 90, textAlign: "right" },
    totalsContainer: {
      flexDirection: "row",
      justifyContent: "flex-end",
      paddingTop: 16,
    },
    totalsBox: {
      width: 280,
    },
    totalsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    totalsLabel: {
      fontSize: 11,
      color: colors.textMuted,
    },
    totalsValue: {
      fontSize: 11,
      fontFamily: "Helvetica-Bold",
      color: colors.text,
    },
    totalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 12,
      paddingHorizontal: 12,
      marginTop: 8,
      backgroundColor: colors.totalBg,
      borderRadius: cornerRadius,
    },
    totalLabel: {
      fontSize: 16,
      fontFamily: "Helvetica-Bold",
      color: colors.text,
    },
    totalValue: {
      fontSize: 18,
      fontFamily: "Helvetica-Bold",
      color: colors.text,
    },
    notesSection: {
      marginTop: 20,
      padding: 12,
      backgroundColor: colors.accent,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
      borderRadius: cornerRadius,
    },
    notesLabel: {
      fontSize: 9,
      fontFamily: "Helvetica-Bold",
      color: colors.primary,
      marginBottom: 4,
      letterSpacing: 1,
    },
    notesText: {
      fontSize: 10,
      color: colors.text,
      lineHeight: 1.5,
    },
    footer: {
      marginTop: 20,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      textAlign: "center",
    },
    footerText: {
      fontSize: 9,
      color: colors.textMuted,
    },
    accentBar: {
      marginTop: 12,
      height: 3,
      backgroundColor: colors.primary,
      borderRadius: 2,
    },
  });
}

function InvoicePdfDocument({ invoice, settings, templateId, customConfig }) {
  if (!invoice) return null;

  const finalTemplateId = templateId ?? settings?.template_id;
  const finalCustom = customConfig ?? settings?.template_config;
  const config = resolveTemplateConfig(finalTemplateId, finalCustom);
  const styles = buildStyles(config);

  const isBanner = config.layout.headerStyle === "banner";
  const items = Array.isArray(invoice.line_items) ? invoice.line_items : [];
  const isDarkTotal =
    DARK_BG_HEX.includes(String(config.colors.totalBg).toLowerCase()) ||
    config.colors.totalBg === config.colors.headerBg;
  const totalTextColor = isDarkTotal ? config.colors.headerText : config.colors.text;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        {isBanner ? (
          <View style={styles.headerBanner}>
            <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
              {config.layout.showLogo && settings?.logo_url ? (
                <Image style={styles.logoInverted} src={settings.logo_url} />
              ) : null}
              <View style={styles.companyBlock}>
                {settings?.company_name ? (
                  <Text style={styles.companyNameInverted}>
                    {settings.company_name}
                  </Text>
                ) : null}
                {settings?.company_address ? (
                  <Text style={styles.companyDetailInverted}>
                    {settings.company_address}
                  </Text>
                ) : null}
                {settings?.company_email || settings?.company_phone ? (
                  <Text style={styles.companyDetailInverted}>
                    {settings.company_email}
                    {settings.company_email && settings.company_phone
                      ? " · "
                      : ""}
                    {settings.company_phone}
                  </Text>
                ) : null}
                {settings?.tax_number ? (
                  <Text style={styles.companyDetailInverted}>
                    Tax #: {settings.tax_number}
                  </Text>
                ) : null}
              </View>
            </View>
            <View style={styles.titleBlock}>
              <Text style={styles.titleInverted}>INVOICE</Text>
              <Text style={styles.invoiceNumberInverted}>
                #{safe(invoice.invoice_number)}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.header}>
            <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
              {config.layout.showLogo && settings?.logo_url ? (
                <Image style={styles.logo} src={settings.logo_url} />
              ) : null}
              <View style={styles.companyBlock}>
                {settings?.company_name ? (
                  <Text style={styles.companyName}>
                    {settings.company_name}
                  </Text>
                ) : null}
                {settings?.company_address ? (
                  <Text style={styles.companyDetail}>
                    {settings.company_address}
                  </Text>
                ) : null}
                {settings?.company_email || settings?.company_phone ? (
                  <Text style={styles.companyDetail}>
                    {settings.company_email}
                    {settings.company_email && settings.company_phone
                      ? " · "
                      : ""}
                    {settings.company_phone}
                  </Text>
                ) : null}
                {settings?.tax_number ? (
                  <Text style={styles.companyDetail}>
                    Tax #: {settings.tax_number}
                  </Text>
                ) : null}
              </View>
            </View>
            <View style={styles.titleBlock}>
              <Text style={styles.title}>INVOICE</Text>
              <Text style={styles.invoiceNumber}>
                #{safe(invoice.invoice_number)}
              </Text>
            </View>
          </View>
        )}

        {config.layout.accentBar && !isBanner ? (
          <View style={styles.accentBar} />
        ) : null}

        {/* Meta section */}
        <View style={styles.metaSection}>
          <View>
            <Text style={styles.metaLabel}>BILLED TO</Text>
            <Text style={styles.metaClientName}>
              {safe(invoice.client_name)}
            </Text>
            {invoice.client_email ? (
              <Text style={styles.metaClientEmail}>
                {invoice.client_email}
              </Text>
            ) : null}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.metaLabel}>INVOICE DETAILS</Text>
            <Text style={styles.metaDetail}>
              Invoice #: {safe(invoice.invoice_number)}
            </Text>
            <Text style={styles.metaDetail}>
              Issue Date: {formatInvoiceDate(invoice.invoice_date)}
            </Text>
            <Text style={styles.metaDetail}>
              Due Date: {formatInvoiceDate(invoice.due_date)}
            </Text>
            {invoice.billing_start_date || invoice.billing_end_date ? (
              <Text style={styles.metaDetail}>
                Billing Period:{" "}
                {formatInvoiceDate(invoice.billing_start_date)} –{" "}
                {formatInvoiceDate(invoice.billing_end_date)}
              </Text>
            ) : null}
            <Text style={styles.metaDetail}>Status: {safe(invoice.status)}</Text>
          </View>
        </View>

        {/* Line items table */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, styles.colDescription]}>
            DESCRIPTION
          </Text>
          <Text style={[styles.tableHeaderCell, styles.colNum]}>QTY</Text>
          <Text style={[styles.tableHeaderCell, styles.colPrice]}>
            UNIT PRICE
          </Text>
          <Text style={[styles.tableHeaderCell, styles.colAmount]}>AMOUNT</Text>
        </View>
        {items.length === 0 ? (
          <View style={styles.tableRow}>
            <Text
              style={[
                styles.tableCell,
                styles.colDescription,
                { textAlign: "center", color: config.colors.textMuted },
              ]}
            >
              No line items
            </Text>
          </View>
        ) : (
          items.map((item, idx) => (
            <View
              key={item.id || idx}
              style={
                config.layout.tableStyle === "striped" && idx % 2 === 1
                  ? styles.tableRowStriped
                  : styles.tableRow
              }
            >
              <Text style={[styles.tableCell, styles.colDescription]}>
                {safe(item.description)}
              </Text>
              <Text style={[styles.tableCell, styles.colNum]}>
                {Number(item.quantity || 0)}
              </Text>
              <Text style={[styles.tableCell, styles.colPrice]}>
                {fmtAmount(item.unit_price, invoice.currency)}
              </Text>
              <Text
                style={[
                  styles.tableCell,
                  styles.colAmount,
                  { fontFamily: "Helvetica-Bold" },
                ]}
              >
                {fmtAmount(item.total, invoice.currency)}
              </Text>
            </View>
          ))
        )}

        {/* Totals */}
        <View style={styles.totalsContainer}>
          <View style={styles.totalsBox}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Subtotal</Text>
              <Text style={styles.totalsValue}>
                {fmtAmount(invoice.subtotal, invoice.currency)}
              </Text>
            </View>
            {Number(invoice.tax_amount || 0) > 0 ? (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>
                  Tax ({Number(invoice.tax_rate || 0).toFixed(2)}%)
                </Text>
                <Text style={styles.totalsValue}>
                  {fmtAmount(invoice.tax_amount, invoice.currency)}
                </Text>
              </View>
            ) : null}
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: totalTextColor }]}>Total</Text>
              <Text style={[styles.totalValue, { color: totalTextColor }]}>
                {fmtAmount(invoice.total, invoice.currency)}
              </Text>
            </View>
          </View>
        </View>

        {/* Notes */}
        {invoice.notes ? (
          <View style={styles.notesSection}>
            <Text style={styles.notesLabel}>NOTES &amp; TERMS</Text>
            <Text style={styles.notesText}>{invoice.notes}</Text>
          </View>
        ) : null}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Thank you for your business!</Text>
        </View>
      </Page>
    </Document>
  );
}

export default InvoicePdfDocument;
