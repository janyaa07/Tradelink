-- Starter notification texts (docs/PLAN.md section 6) in English, Chinese, Malay and Tamil. Titles are
-- at most 65 characters and bodies at most 178; {{1}}-style variables are filled by
-- src/notifications/templates.ts, and every language of a type uses the same variables.
--
-- order_summary          {{1}} item count, {{2}} delivery day, {{3}} cut-off time
-- finish_order_reminder  {{1}} delivery day, {{2}} cut-off time
-- supplier_po            {{1}} shop name, {{2}} line count, {{3}} delivery day
-- po_change_result       {{1}} supplier name, {{2}} delivery day, {{3}} short change summary
-- arrival_check          {{1}} supplier name
-- agent_action_notice    {{1}} what Restock did, {{2}} undo deadline
-- support_reply          {{1}} support person's first name
-- daily_plan_ready       {{1}} delivery day, {{2}} item count, {{3}} cut-off time
insert into public.notification_type (name, language, channel, title, body) values
  ('order_summary', 'en', 'push', 'Your order is ready to check', '{{1}} items for {{2}}. Check the summary and confirm it before {{3}}.'),
  ('order_summary', 'zh', 'push', '您的订单已准备好，请核对', '{{2}}送货，共{{1}}件商品。请在{{3}}前核对并确认。'),
  ('order_summary', 'ms', 'push', 'Pesanan anda sedia untuk disemak', '{{1}} barang untuk {{2}}. Semak ringkasan dan sahkan sebelum {{3}}.'),
  ('order_summary', 'ta', 'push', 'உங்கள் ஆர்டர் சரிபார்க்கத் தயார்', '{{2}} அன்று {{1}} பொருட்கள். {{3}} க்கு முன் சுருக்கத்தைச் சரிபார்த்து உறுதிசெய்யவும்.'),

  ('finish_order_reminder', 'en', 'push', 'Finish your order for {{1}}', 'Your order is not confirmed yet. Confirm it before {{2}} so your suppliers get it in time.'),
  ('finish_order_reminder', 'zh', 'push', '请完成{{1}}的订单', '您的订单尚未确认。请在{{2}}前确认，以便供应商及时收到。'),
  ('finish_order_reminder', 'ms', 'push', 'Selesaikan pesanan anda untuk {{1}}', 'Pesanan anda belum disahkan. Sahkan sebelum {{2}} supaya pembekal menerimanya tepat pada masanya.'),
  ('finish_order_reminder', 'ta', 'push', '{{1}} ஆர்டரை முடிக்கவும்', 'உங்கள் ஆர்டர் இன்னும் உறுதிசெய்யப்படவில்லை. சப்ளையர்கள் நேரத்தில் பெற {{2}} க்கு முன் உறுதிசெய்யவும்.'),

  ('supplier_po', 'en', 'push', 'New order from {{1}}', '{{2}} lines for delivery on {{3}}. Open it to accept the order or change lines.'),
  ('supplier_po', 'zh', 'push', '来自{{1}}的新订单', '共{{2}}项，{{3}}送货。打开订单以接受或修改。'),
  ('supplier_po', 'ms', 'push', 'Pesanan baharu daripada {{1}}', '{{2}} baris untuk penghantaran pada {{3}}. Buka untuk terima pesanan atau ubah baris.'),
  ('supplier_po', 'ta', 'push', '{{1}} இடமிருந்து புதிய ஆர்டர்', '{{3}} டெலிவரிக்கு {{2}} வரிகள். ஆர்டரை ஏற்க அல்லது வரிகளை மாற்ற திறக்கவும்.'),

  ('po_change_result', 'en', 'push', '{{1}} answered your order', 'Your order for {{2}}: {{3}}. Open it to see what changed.'),
  ('po_change_result', 'zh', 'push', '{{1}}已回复您的订单', '您{{2}}的订单：{{3}}。打开订单查看变更。'),
  ('po_change_result', 'ms', 'push', '{{1}} telah membalas pesanan anda', 'Pesanan anda untuk {{2}}: {{3}}. Buka untuk lihat perubahan.'),
  ('po_change_result', 'ta', 'push', '{{1}} உங்கள் ஆர்டருக்குப் பதிலளித்தார்', '{{2}} ஆர்டர்: {{3}}. மாற்றங்களைப் பார்க்க திறக்கவும்.'),

  ('arrival_check', 'en', 'push', 'Did your delivery from {{1}} arrive?', 'Tell us if everything arrived, something is wrong, or it is not here yet.'),
  ('arrival_check', 'zh', 'push', '{{1}}的货到了吗？', '请告诉我们货物是否全部送达、有问题，或尚未送到。'),
  ('arrival_check', 'ms', 'push', 'Adakah penghantaran daripada {{1}} sudah tiba?', 'Beritahu kami jika semua sudah tiba, ada masalah, atau belum sampai.'),
  ('arrival_check', 'ta', 'push', '{{1}} டெலிவரி வந்ததா?', 'எல்லாம் வந்ததா, ஏதாவது பிரச்சனையா, அல்லது இன்னும் வரவில்லையா என்று சொல்லுங்கள்.'),

  ('agent_action_notice', 'en', 'push', 'Restock made a change for you', '{{1}}. You can undo this until {{2}}.'),
  ('agent_action_notice', 'zh', 'push', 'Restock 已为您做出更改', '{{1}}。您可以在{{2}}前撤销。'),
  ('agent_action_notice', 'ms', 'push', 'Restock membuat perubahan untuk anda', '{{1}}. Anda boleh membatalkannya sehingga {{2}}.'),
  ('agent_action_notice', 'ta', 'push', 'Restock உங்களுக்காக ஒரு மாற்றம் செய்தது', '{{1}}. {{2}} வரை இதைச் செயல்தவிர்க்கலாம்.'),

  ('support_reply', 'en', 'push', 'Support replied', '{{1}} replied to your message. Open the chat to read it.'),
  ('support_reply', 'zh', 'push', '客服已回复', '{{1}}回复了您的消息。打开聊天查看。'),
  ('support_reply', 'ms', 'push', 'Sokongan telah membalas', '{{1}} membalas mesej anda. Buka sembang untuk membacanya.'),
  ('support_reply', 'ta', 'push', 'உதவிக் குழு பதிலளித்தது', '{{1}} உங்கள் செய்திக்குப் பதிலளித்தார். படிக்க அரட்டையைத் திறக்கவும்.'),

  ('daily_plan_ready', 'en', 'push', 'Your order plan for {{1}} is ready', '{{2}} items are due. Check the plan and confirm it before {{3}}.'),
  ('daily_plan_ready', 'zh', 'push', '{{1}}的订货计划已准备好', '有{{2}}件商品需要订购。请在{{3}}前核对并确认计划。'),
  ('daily_plan_ready', 'ms', 'push', 'Pelan pesanan anda untuk {{1}} sudah sedia', '{{2}} barang perlu dipesan. Semak pelan dan sahkan sebelum {{3}}.'),
  ('daily_plan_ready', 'ta', 'push', '{{1}} க்கான ஆர்டர் திட்டம் தயார்', '{{2}} பொருட்கள் ஆர்டர் செய்ய வேண்டும். {{3}} க்கு முன் திட்டத்தைச் சரிபார்த்து உறுதிசெய்யவும்.')
on conflict (name, language) do update
  set channel = excluded.channel, title = excluded.title, body = excluded.body,
      version = public.notification_type.version + 1;
