/**
 * rms-client.mjs — 楽天市場 RMS 受注API (REST JSON) クライアント
 *
 * 認証: ESA {Base64(serviceSecret:licenseKey)}
 * エンドポイント:
 *   searchOrder: POST https://api.rms.rakuten.co.jp/es/2.0/order/searchOrder/
 *   getOrder:    POST https://api.rms.rakuten.co.jp/es/2.0/order/getOrder/
 *
 * フロー:
 *   1. searchOrder → 注文番号リストを取得（最大1000件/ページ）
 *   2. getOrder   → 注文詳細を取得（100件/リクエスト上限、version:8 必須）
 */

import { config } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '../../.env') });

const SERVICE_SECRET = process.env.RAKUTEN_SERVICE_SECRET;
const LICENSE_KEY    = process.env.RAKUTEN_LICENSE_KEY;

const BASE_URL       = 'https://api.rms.rakuten.co.jp/es/2.0/order';
const GET_ORDER_VER  = 8; // getOrder の必須バージョン番号

// 取得する注文ステータス（全ステータス）
const ALL_ORDER_STATUSES = [100, 200, 300, 400, 500, 600, 700, 800];

/**
 * ESA認証ヘッダーを生成
 */
function buildAuthHeader() {
  if (!SERVICE_SECRET || !LICENSE_KEY) {
    throw new Error('RAKUTEN_SERVICE_SECRET / RAKUTEN_LICENSE_KEY が .env に未設定です');
  }
  const token = Buffer.from(`${SERVICE_SECRET}:${LICENSE_KEY}`).toString('base64');
  return `ESA ${token}`;
}

/**
 * RMS REST APIにPOSTリクエストを送信
 */
async function postJson(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': buildAuthHeader(),
      'Content-Type':  'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    const msg = data?.MessageModelList?.[0]?.message || `HTTP ${res.status}`;
    throw new Error(`RMS API エラー [${res.status}]: ${msg}`);
  }

  // APIレベルのエラーチェック
  const errors = (data.MessageModelList || []).filter(m => m.messageType === 'ERROR');
  if (errors.length > 0) {
    throw new Error(`RMS API エラー: ${errors.map(e => e.message).join(' / ')}`);
  }

  return data;
}

/**
 * searchOrder — 対象期間の注文番号リストを取得
 *
 * @param {string} startDate - 'YYYY-MM-DD'
 * @param {string} endDate   - 'YYYY-MM-DD'
 * @param {number[]} statuses - 取得する注文ステータス
 * @returns {Promise<string[]>} 注文番号の配列
 */
export async function searchOrders(startDate, endDate, statuses = ALL_ORDER_STATUSES) {
  let allOrderNumbers = [];
  let page = 1;
  let totalPages = 1;

  console.log(`[RMS] searchOrder: ${startDate} 〜 ${endDate}`);

  while (page <= totalPages) {
    const data = await postJson('/searchOrder/', {
      dateType: 1,
      startDatetime: `${startDate}T00:00:00+0900`,
      endDatetime:   `${endDate}T23:59:59+0900`,
      orderProgressList: statuses,
      PaginationRequestModel: {
        requestRecordsAmount: 1000,
        requestPage: page,
      },
    });

    const orderNumbers = data.orderNumberList || [];
    allOrderNumbers = allOrderNumbers.concat(orderNumbers);

    const pagination = data.PaginationResponseModel || {};
    totalPages = pagination.totalPages || 1;
    const total  = pagination.totalRecordsAmount || allOrderNumbers.length;

    console.log(`[RMS] searchOrder page${page}/${totalPages}: ${orderNumbers.length}件取得 (累計: ${allOrderNumbers.length}/${total}件)`);

    page++;

    if (page <= totalPages) {
      await new Promise(r => setTimeout(r, 500)); // レート制限対策
    }
  }

  return allOrderNumbers;
}

/**
 * getOrder — 注文番号リストから注文詳細を取得
 *
 * @param {string[]} orderNumbers
 * @returns {Promise<Array<{order: object, items: object[]}>>}
 */
export async function getOrderDetails(orderNumbers) {
  const BATCH_SIZE = 100;
  const results = [];

  for (let i = 0; i < orderNumbers.length; i += BATCH_SIZE) {
    const batch = orderNumbers.slice(i, i + BATCH_SIZE);

    const data = await postJson('/getOrder/', {
      orderNumberList: batch,
      version: GET_ORDER_VER,
    });

    const orderModels = data.OrderModelList || [];
    for (const order of orderModels) {
      const parsed = parseOrderModel(order);
      if (parsed) results.push(parsed);
    }

    console.log(`[RMS] getOrder: ${Math.min(i + BATCH_SIZE, orderNumbers.length)}/${orderNumbers.length}件 取得済み`);

    if (i + BATCH_SIZE < orderNumbers.length) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  return results;
}

/**
 * 実際のAPIレスポンス構造に基づいてOrderModelをパース
 * 実測フィールド名（2026/03時点）:
 *   Order: orderNumber, orderDatetime, orderProgress, goodsPrice, postagePrice,
 *          paymentCharge, totalPrice, couponAllTotalPrice, OrdererModel,
 *          SettlementModel, PointModel, DeliveryModel, PackageModelList
 *   Item:  itemNumber, itemName, selectedChoice, priceTaxIncl, units, pointRate
 */
function parseOrderModel(o) {
  if (!o?.orderNumber) return null;

  // 注文日時をJSTで処理（"2026-03-13T12:40:06+0900"形式）
  const orderDate    = o.orderDatetime ? new Date(o.orderDatetime) : null;
  const orderDateJst = orderDate
    ? o.orderDatetime.slice(0, 10)  // "+0900"の場合そのまま日付部分を使用
    : null;

  const order = {
    order_number:    o.orderNumber,
    order_date:      orderDate ? orderDate.toISOString() : null,
    order_date_jst:  orderDateJst,
    order_progress:  o.orderProgress ?? null,
    customer_id:     o.OrdererModel?.emailAddress ?? o.OrdererModel?.ordererName ?? null,
    subtotal_price:  o.goodsPrice ?? null,
    postage:         o.postagePrice ?? null,
    charge:          o.paymentCharge ?? null,
    total_price:     o.totalPrice ?? null,
    point_used:      o.PointModel?.usePoint ?? null,
    coupon_discount: o.couponAllTotalPrice ?? null,
    settlement_name: o.SettlementModel?.settlementName ?? null,
    delivery_pref:   o.DeliveryModel?.prefecture ?? null,
    is_new_customer: null, // APIから取得不可
    inserted_at:     new Date().toISOString(),
  };

  // 商品明細（PackageModelList > ItemModelList）
  const items = [];
  for (const pkg of (o.PackageModelList || [])) {
    const packageId = String(pkg.basketId ?? '');

    for (const item of (pkg.ItemModelList || [])) {
      const unitPrice = item.priceTaxIncl ?? null; // 税込単価
      const quantity  = item.units ?? null;

      items.push({
        order_number:   o.orderNumber,
        order_date_jst: orderDateJst,
        package_id:     packageId || null,
        item_id:        item.itemNumber ?? item.itemId ?? null,
        item_name:      item.itemName ?? null,
        item_option:    item.selectedChoice ?? null,
        unit_price:     unitPrice,
        quantity:       quantity,
        item_total:     (unitPrice != null && quantity != null)
                          ? unitPrice * quantity
                          : null,
        point_amount:   item.pointRate ?? null,
        inserted_at:    new Date().toISOString(),
      });
    }
  }

  return { order, items };
}

/**
 * 指定期間の全受注データを一括取得（searchOrder + getOrder）
 *
 * @param {string} startDate - 'YYYY-MM-DD'
 * @param {string} endDate   - 'YYYY-MM-DD'
 * @returns {Promise<{orders: object[], items: object[]}>}
 */
export async function fetchAllOrders(startDate, endDate) {
  const orderNumbers = await searchOrders(startDate, endDate);

  if (orderNumbers.length === 0) {
    console.log('[RMS] 対象期間に注文データなし');
    return { orders: [], items: [] };
  }

  const orderDetails = await getOrderDetails(orderNumbers);

  const orders = orderDetails.map(d => d.order);
  const items  = orderDetails.flatMap(d => d.items);

  console.log(`[RMS] 取得完了: 受注${orders.length}件 / 明細${items.length}行`);
  return { orders, items };
}
