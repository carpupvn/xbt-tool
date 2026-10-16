/* Mapping tên tiếng Việt cho mọi field trong save */
(function (global) {
  'use strict';

  // Món xôi (unlocked / cooked / prices)
  const DISH = {
    doxanh:   'Xôi đỗ xanh',
    lac:      'Xôi lạc',
    gac:      'Xôi gấc',
    ladua:    'Xôi lá dứa',
    xeo:      'Xôi xéo',
    lacam:    'Xôi lá cẩm',
    dauden:   'Xôi đậu đen',
    nepcam:   'Xôi nếp cẩm',
    mit:      'Xôi mít',
    ga:       'Xôi gà',
    san:      'Xôi sắn',
    bap:      'Xôi bắp',
    vo:       'Xôi vò',
    com:      'Xôi cốm',
    khuc:     'Xôi khúc',
    thit:     'Xôi thịt kho',
    chuoi:    'Xôi chuối',
    xoai:     'Xôi xoài',
    saurieng: 'Xôi sầu riêng',
    patecha:  'Xôi pate chả',
    trungcut: 'Xôi trứng cút',
    lapxuong: 'Xôi lạp xưởng',
    thapcam:  'Xôi thập cẩm',
    ngusac:   'Xôi ngũ sắc',
  };

  // Nguyên liệu kho (stock)
  const ING = {
    nep:      'Nếp cái',
    nepcam:   'Nếp cẩm',
    gac:      'Gấc',
    doxanh:   'Đỗ xanh',
    lac:      'Lạc',
    dua:      'Dừa',
    ladua:    'Lá dứa',
    lacam:    'Lá cẩm',
    dauden:   'Đậu đen',
    mit:      'Mít',
    hanh:     'Hành',
    ga:       'Gà',
    vung:     'Vừng',
    bap:      'Bắp',
    san:      'Sắn',
    com:      'Cốm',
    raukhuc:  'Rau khúc',
    thit:     'Thịt',
    xoai:     'Xoài',
    chuoi:    'Chuối',
    saurieng: 'Sầu riêng',
    pate:     'Pate',
    cha:      'Chả',
    trung:    'Trứng',
    lapxuong: 'Lạp xưởng',
  };

  // Nâng cấp (upg)
  const UPG = {
    noi:  'Nồi đồ xôi',
    la:   'Lá gói',
    ghe:  'Ghế nhựa',
    loa:  'Loa phóng thanh',
    tra:  'Ấm trà đá',
    ti:   'Tí (phụ bán)',
    inox: 'Tủ inox',
  };

  // Thành tựu (ach)
  const ACH = {
    mohang:     'Mở hàng',
    tay50:      'Tay 50 phần',
    tay300:     'Tay 300 phần',
    tay1000:    'Tay 1000 phần',
    gac50:      'Gấc 50',
    xeo30:      'Xéo 30',
    dumon:      'Đủ món',
    khongcho:   'Không chờ',
    batqua:     'Bắt quả tang',
    namsao:     'Năm sao',
    laidam:     'Lãi đậm',
    tuluc:      'Tự lực',
    duvon:      'Dư vốn',
    saolang:    'Sao làng',
    thantoc:    'Thần tốc',
    trano:      'Trả nợ',
    chutiem:    'Chủ tiệm',
    tramtrieu:  'Trăm triệu',
    lenpho:     'Lên phố',
    dongthue:   'Đóng thuế',
    thuonghieu: 'Thương hiệu',
    bachinhanh: 'Ba chi nhánh',
    bitruyen:   'Bí truyền',
    noinghiep:  'Nối nghiệp',
    viral:      'Viral',
    muaro:      'Mùa rơ',
  };

  // Stats
  const STAT = {
    served:      'Đã phục vụ',
    caught:      'Bắt kẻ trộm',
    escaped:     'Trộm chạy thoát',
    perfect:     'Ngày hoàn hảo',
    bestNet:     'Lãi ngày cao nhất',
    soldOut:     'Ngày hết hàng',
    rainBest:    'Ngày mưa tốt nhất',
    thiefCaught: 'Tóm kẻ trộm',
    forgive:     'Đã tha thứ',
    app:         'Đơn app',
    viral:       'Lần viral',
    vsPass:      'Pass VSATTP',
    rivalWin:    'Thắng đối thủ',
    copWin:      'Thoát công an',
  };

  global.XoiDict = { DISH, ING, UPG, ACH, STAT };
})(window);