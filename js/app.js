/* =========================================================
   Sistem Informasi Sekolah - SMAN 10 Tasikmalaya
   JavaScript: sidebar, filter tabel, modal, form + LocalStorage.
   ========================================================= */
(function () {
  'use strict';

  /* ---------- Helper umum ---------- */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function esc(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function byId(list, id) {
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(id)) return list[i];
    }
    return null;
  }

  function setOptions(select, items, placeholder) {
    select.innerHTML = '';
    if (placeholder !== null && placeholder !== undefined) {
      var ph = document.createElement('option');
      ph.value = '';
      ph.textContent = placeholder;
      select.appendChild(ph);
    }
    items.forEach(function (it) {
      var o = document.createElement('option');
      o.value = it.v;
      o.textContent = it.t;
      select.appendChild(o);
    });
  }

  function kelasOf(jurusanId) {
    return KELAS.filter(function (k) { return String(k.jurusan) === String(jurusanId); });
  }
  function kelasItems(list) {
    return list.map(function (k) { return { v: k.id, t: k.nama }; });
  }

  var alertTimer = null;
  function showAlert(type, msg) {
    var box = $('#Doniza_notif');
    if (!box) return;
    var icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation';
    box.innerHTML = '<div class="Doniza_alert Doniza_alert_' + type + '"><i class="fa-solid ' + icon + '"></i><span>' + esc(msg) + '</span></div>';
    clearTimeout(alertTimer);
    alertTimer = setTimeout(function () { box.innerHTML = ''; }, 5000);
  }

  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  /* ---------- Sidebar ---------- */
  var layout = $('.Doniza_layout');
  var menuBtn = $('#Doniza_menuBtn');
  if (layout && menuBtn) {
    if (window.innerWidth <= 768) layout.classList.add('Doniza_sidebar_collapsed');
    menuBtn.addEventListener('click', function () {
      layout.classList.toggle('Doniza_sidebar_collapsed');
    });
  }

  /* ---------- Modal ---------- */
  function openModal(el) { el.classList.add('Doniza_open'); }
  function closeModal(el) { el.classList.remove('Doniza_open'); }

  document.addEventListener('click', function (e) {
    var closer = e.target.closest('[data-close-modal]');
    if (closer) { closeModal(closer.closest('.Doniza_modal_backdrop')); return; }
    if (e.target.classList && e.target.classList.contains('Doniza_modal_backdrop')) closeModal(e.target);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') $$('.Doniza_modal_backdrop.Doniza_open').forEach(closeModal);
  });

  /* ---------- Pills (filter jurusan) ---------- */
  function setPill(group, value) {
    $$('.Doniza_pill', group).forEach(function (b) {
      b.classList.toggle('Doniza_active', b.getAttribute('data-value') === String(value));
    });
  }
  function getPill(group) {
    var a = $('.Doniza_pill.Doniza_active', group);
    return a ? a.getAttribute('data-value') : '';
  }
  function initPills(group, onChange) {
    $$('.Doniza_pill', group).forEach(function (b) {
      b.addEventListener('click', function () {
        setPill(group, b.getAttribute('data-value'));
        onChange(b.getAttribute('data-value'));
      });
    });
  }

  /* ---------- Filter baris tabel ---------- */
  function filterTable(tbody, predicate) {
    var n = 0;
    $$('tr[data-row]', tbody).forEach(function (tr) {
      var ok = predicate(tr);
      tr.hidden = !ok;
      if (ok) { n++; tr.cells[0].textContent = n; }
    });
    var empty = $('.Doniza_empty_row', tbody);
    if (empty) empty.hidden = n > 0;
    return n;
  }

  /* =========================================================
     DASHBOARD
     ========================================================= */
  function initDashboard() {
    var HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    var BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    var now = new Date();
    var hari = HARI[now.getDay()];

    $('#Doniza_tanggalHariIni').textContent = pad(now.getDate()) + ' ' + BLN[now.getMonth()] + ' ' + now.getFullYear();
    $('#Doniza_hariIni').textContent = hari;

    // Update angka statistik jika elemen tersedia
    var statSiswa = $('#Doniza_statSiswa');
    if (statSiswa) statSiswa.textContent = SISWA.length;
    var statGuru = $('#Doniza_statGuru');
    if (statGuru && Array.isArray(GURU)) statGuru.textContent = GURU.length;

    var found = false;
    $$('.Doniza_jadwal_hari').forEach(function (blk) {
      var match = blk.getAttribute('data-hari') === hari;
      blk.hidden = !match;
      if (match) found = true;
    });
    $('#Doniza_jadwalKosong').hidden = found;
  }

  /* =========================================================
     SISWA (Tersinkronisasi dengan LocalStorage)
     ========================================================= */
  function initSiswa() {
    var tbody = $('#Doniza_tbodySiswa');
    var pills = $('#Doniza_pillsJurusan');
    var search = $('#Doniza_search');
    var modal = $('#Doniza_formModal');
    var form = $('#Doniza_formSiswa');
    var selJur = $('#Doniza_fJurusan');
    var selKelas = $('#Doniza_fKelas');
    var errBox = $('#Doniza_formError');
    var editing = null;

    setOptions(selJur, JURUSAN.map(function (j) { return { v: j.id, t: j.nama }; }), '-- Pilih Jurusan --');

    function fillKelas(jur, selected) {
      if (!jur) {
        selKelas.disabled = true;
        setOptions(selKelas, [], '-- Pilih Jurusan Terlebih Dahulu --');
        return;
      }
      var list = kelasOf(jur);
      selKelas.disabled = false;
      setOptions(selKelas, kelasItems(list), list.length ? '-- Pilih Kelas --' : '-- Tidak ada kelas di jurusan ini --');
      if (selected) selKelas.value = selected;
    }

    function renderRow(tr, d) {
      var jur = byId(JURUSAN, d.jurusan);
      tr.dataset.nis = d.nis;
      tr.dataset.nama = d.nama;
      tr.dataset.jurusan = d.jurusan;
      tr.dataset.kelas = d.kelas;
      tr.dataset.kelasNama = d.kelasNama;
      tr.dataset.jk = d.jk;
      tr.innerHTML =
        '<td class="Doniza_text_center Doniza_muted"></td>' +
        '<td class="Doniza_muted">' + esc(d.nis) + '</td>' +
        '<td class="Doniza_strong">' + esc(d.nama) + '</td>' +
        '<td><span class="Doniza_badge">' + esc(jur ? jur.nama : 'Belum Diatur') + '</span></td>' +
        '<td>' + esc(d.kelasNama) + '</td>' +
        '<td class="Doniza_muted">' + esc(d.jk) + '</td>' +
        '<td><div class="Doniza_actions">' +
        '<button type="button" class="Doniza_btn_icon Doniza_btn_edit Doniza_js_edit" title="Edit"><i class="fa-solid fa-pen"></i></button>' +
        '<button type="button" class="Doniza_btn_icon Doniza_btn_delete Doniza_js_delete" title="Hapus"><i class="fa-solid fa-trash"></i></button>' +
        '</div></td>';
    }

    // Muat ulang tabel dari array SISWA (LocalStorage)
    function rebuildTableFromStorage() {
      var emptyRow = $('.Doniza_empty_row', tbody);
      $$('tr[data-row]', tbody).forEach(function (tr) { tr.remove(); });
      SISWA.forEach(function (s) {
        var kls = byId(KELAS, s.kelas);
        var tr = document.createElement('tr');
        tr.setAttribute('data-row', '');
        renderRow(tr, {
          nis: s.nis,
          nama: s.nama,
          jurusan: String(s.jurusan),
          kelas: String(s.kelas),
          kelasNama: kls ? kls.nama : '',
          jk: s.jk
        });
        tbody.insertBefore(tr, emptyRow);
      });
    }

    function syncSiswaStorage() {
      SISWA = $$('tr[data-row]', tbody).map(function (tr) {
        return {
          nis: tr.dataset.nis,
          nama: tr.dataset.nama,
          kelas: Number(tr.dataset.kelas),
          jurusan: Number(tr.dataset.jurusan),
          jk: tr.dataset.jk
        };
      });
      DB.save('siswa', SISWA);
    }

    function apply() {
      var jur = getPill(pills);
      var q = search.value.trim().toLowerCase();
      filterTable(tbody, function (tr) {
        var d = tr.dataset;
        if (d.jurusan !== jur) return false;
        if (!q) return true;
        return (d.nama + ' ' + d.nis + ' ' + d.kelasNama).toLowerCase().indexOf(q) > -1;
      });
    }

    function openForm(tr) {
      editing = tr || null;
      errBox.innerHTML = '';
      form.reset();
      if (tr) {
        var d = tr.dataset;
        $('#Doniza_modalTitle').textContent = 'Edit Data Siswa';
        form.elements.nis.value = d.nis;
        form.elements.nama.value = d.nama;
        selJur.value = d.jurusan;
        fillKelas(d.jurusan, d.kelas);
        form.elements.jk.value = d.jk;
      } else {
        $('#Doniza_modalTitle').textContent = 'Tambah Data Siswa Baru';
        fillKelas('');
      }
      openModal(modal);
    }

    selJur.addEventListener('change', function () { fillKelas(selJur.value); });
    initPills(pills, apply);
    search.addEventListener('input', apply);
    $('#Doniza_btnTambah').addEventListener('click', function () { openForm(null); });

    tbody.addEventListener('click', function (e) {
      var tr = e.target.closest('tr[data-row]');
      if (!tr) return;
      if (e.target.closest('.Doniza_js_edit')) openForm(tr);
      if (e.target.closest('.Doniza_js_delete')) {
        if (confirm('Apakah Anda yakin ingin menghapus data siswa ini?')) {
          var deletedNis = tr.dataset.nis;
          tr.remove();
          syncSiswaStorage();
          // Bersihkan juga data absensi & nilai siswa yang dihapus
          delete ABSENSI[deletedNis];
          DB.save('absensi', ABSENSI);
          NILAI = NILAI.filter(function (r) { return r[0] !== deletedNis; });
          DB.save('nilai', NILAI);

          apply();
          showAlert('success', 'Data siswa berhasil dihapus secara permanen.');
        }
      }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var kelas = byId(KELAS, selKelas.value);
      var d = {
        nis: form.elements.nis.value.trim(),
        nama: form.elements.nama.value.trim(),
        jurusan: selJur.value,
        kelas: selKelas.value,
        kelasNama: kelas ? kelas.nama : '',
        jk: form.elements.jk.value
      };
      var duplikat = $$('tr[data-row]', tbody).some(function (tr) {
        return tr !== editing && tr.dataset.nis === d.nis;
      });
      if (duplikat) {
        errBox.innerHTML = '<div class="Doniza_alert Doniza_alert_error Doniza_form_error"><i class="fa-solid fa-circle-exclamation"></i><span>Gagal! NIS sudah terdaftar di sistem.</span></div>';
        return;
      }
      if (editing) {
        var oldNis = editing.dataset.nis;
        renderRow(editing, d);
        if (oldNis !== d.nis) {
          if (ABSENSI[oldNis]) { ABSENSI[d.nis] = ABSENSI[oldNis]; delete ABSENSI[oldNis]; DB.save('absensi', ABSENSI); }
          NILAI.forEach(function (r) { if (r[0] === oldNis) r[0] = d.nis; });
          DB.save('nilai', NILAI);
        }
      } else {
        var tr = document.createElement('tr');
        tr.setAttribute('data-row', '');
        renderRow(tr, d);
        var empty = $('.Doniza_empty_row', tbody);
        tbody.insertBefore(tr, empty);
      }
      syncSiswaStorage();
      setPill(pills, d.jurusan);
      apply();
      closeModal(modal);
      showAlert('success', editing ? 'Sukses! Data siswa berhasil diperbarui.' : 'Sukses! Data siswa berhasil ditambahkan.');
    });

    rebuildTableFromStorage();
    apply();
  }

  /* =========================================================
     GURU (Tersinkronisasi dengan LocalStorage)
     ========================================================= */
  function initGuru() {
    var tbody = $('#Doniza_tbodyGuru');
    var search = $('#Doniza_search');
    var modal = $('#Doniza_formModal');
    var form = $('#Doniza_formGuru');
    var selMapel = $('#Doniza_fMapel');
    var errBox = $('#Doniza_formError');
    var editing = null;

    setOptions(selMapel, MAPEL.map(function (m) { return { v: m.id, t: m.nama }; }), '-- Pilih Mata Pelajaran --');

    function renderRow(tr, d) {
      tr.dataset.nip = d.nip;
      tr.dataset.nama = d.nama;
      tr.dataset.mapel = d.mapel;
      tr.dataset.mapelNama = d.mapelNama;
      tr.innerHTML =
        '<td class="Doniza_text_center Doniza_muted"></td>' +
        '<td>' + esc(d.nip) + '</td>' +
        '<td class="Doniza_strong">' + esc(d.nama) + '</td>' +
        '<td>' + esc(d.mapelNama) + '</td>' +
        '<td><div class="Doniza_actions">' +
        '<button type="button" class="Doniza_btn_icon Doniza_btn_edit Doniza_js_edit" title="Edit"><i class="fa-solid fa-pen"></i></button>' +
        '<button type="button" class="Doniza_btn_icon Doniza_btn_delete Doniza_js_delete" title="Hapus"><i class="fa-solid fa-trash"></i></button>' +
        '</div></td>';
    }

    function syncGuruStorage() {
      GURU = $$('tr[data-row]', tbody).map(function (tr) {
        return {
          nip: tr.dataset.nip,
          nama: tr.dataset.nama,
          mapel: tr.dataset.mapel,
          mapelNama: tr.dataset.mapelNama
        };
      });
      DB.save('guru', GURU);
    }

    // Jika sudah ada data GURU di localStorage, muat dari localStorage; jika belum, simpan data bawaan HTML
    if (Array.isArray(GURU)) {
      var emptyRow = $('.Doniza_empty_row', tbody);
      $$('tr[data-row]', tbody).forEach(function (tr) { tr.remove(); });
      GURU.forEach(function (g) {
        var tr = document.createElement('tr');
        tr.setAttribute('data-row', '');
        renderRow(tr, g);
        tbody.insertBefore(tr, emptyRow);
      });
    } else {
      syncGuruStorage();
    }

    function apply() {
      var q = search.value.trim().toLowerCase();
      filterTable(tbody, function (tr) {
        if (!q) return true;
        var d = tr.dataset;
        return (d.nama + ' ' + d.nip + ' ' + d.mapelNama).toLowerCase().indexOf(q) > -1;
      });
    }

    function openForm(tr) {
      editing = tr || null;
      errBox.innerHTML = '';
      form.reset();
      if (tr) {
        $('#Doniza_modalTitle').textContent = 'Edit Data Guru';
        form.elements.nip.value = tr.dataset.nip;
        form.elements.nama.value = tr.dataset.nama;
        selMapel.value = tr.dataset.mapel;
      } else {
        $('#Doniza_modalTitle').textContent = 'Tambah Data Guru Baru';
      }
      openModal(modal);
    }

    search.addEventListener('input', apply);
    $('#Doniza_btnTambah').addEventListener('click', function () { openForm(null); });

    tbody.addEventListener('click', function (e) {
      var tr = e.target.closest('tr[data-row]');
      if (!tr) return;
      if (e.target.closest('.Doniza_js_edit')) openForm(tr);
      if (e.target.closest('.Doniza_js_delete')) {
        if (confirm('Apakah Anda yakin ingin menghapus data guru ini?')) {
          tr.remove();
          syncGuruStorage();
          apply();
          showAlert('success', 'Data guru berhasil dihapus secara permanen.');
        }
      }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var mapel = byId(MAPEL, selMapel.value);
      var d = {
        nip: form.elements.nip.value.trim(),
        nama: form.elements.nama.value.trim(),
        mapel: selMapel.value,
        mapelNama: mapel ? mapel.nama : ''
      };
      var duplikat = $$('tr[data-row]', tbody).some(function (tr) {
        return tr !== editing && tr.dataset.nip === d.nip;
      });
      if (duplikat) {
        errBox.innerHTML = '<div class="Doniza_alert Doniza_alert_error Doniza_form_error"><i class="fa-solid fa-circle-exclamation"></i><span>Gagal! NIP sudah terdaftar di sistem.</span></div>';
        return;
      }
      if (editing) {
        renderRow(editing, d);
      } else {
        var tr = document.createElement('tr');
        tr.setAttribute('data-row', '');
        renderRow(tr, d);
        tbody.insertBefore(tr, $('.Doniza_empty_row', tbody));
      }
      syncGuruStorage();
      search.value = '';
      apply();
      closeModal(modal);
      showAlert('success', editing ? 'Sukses! Data guru berhasil diperbarui.' : 'Sukses! Data guru berhasil ditambahkan.');
    });

    apply();
  }

  /* =========================================================
     JADWAL
     ========================================================= */
  function initJadwal() {
    var tbody = $('#Doniza_tbodyJadwal');
    var pills = $('#Doniza_pillsJurusan');
    var selKelas = $('#Doniza_selKelas');
    var selHari = $('#Doniza_selHari');

    function apply() {
      filterTable(tbody, function (tr) {
        return tr.dataset.kelas === selKelas.value && tr.dataset.hari === selHari.value;
      });
    }
    function refreshKelas() {
      setOptions(selKelas, kelasItems(kelasOf(getPill(pills))), null);
      apply();
    }

    initPills(pills, refreshKelas);
    selKelas.addEventListener('change', apply);
    selHari.addEventListener('change', apply);
    refreshKelas();
  }

  /* =========================================================
     ABSENSI (Tersinkronisasi dengan LocalStorage)
     ========================================================= */
  var STATUS_NAMA = { H: 'Hadir', I: 'Izin', S: 'Sakit', A: 'Alpha' };
  var NAMA_STATUS = { Hadir: 'H', Izin: 'I', Sakit: 'S', Alpha: 'A' };

  function paintStatus(sel) {
    sel.className = 'Doniza_status_select Doniza_s_' + sel.value.toLowerCase();
  }

  function initAbsensi() {
    var tbody = $('#Doniza_tbodyAbsensi');
    var pills = $('#Doniza_pillsJurusan');
    var selKelas = $('#Doniza_selKelas');
    var tgl = $('#Doniza_tanggal');

    // Bangun ulang daftar baris siswa agar siswa baru dari localStorage ikut muncul
    function rebuildAbsensiRows() {
      var emptyRow = $('.Doniza_empty_row', tbody);
      $$('tr[data-row]', tbody).forEach(function (tr) { tr.remove(); });
      SISWA.forEach(function (s) {
        var kls = byId(KELAS, s.kelas);
        var tr = document.createElement('tr');
        tr.setAttribute('data-row', '');
        tr.dataset.nis = s.nis;
        tr.dataset.kelas = String(s.kelas);
        tr.innerHTML =
          '<td class="Doniza_text_center Doniza_muted"></td>' +
          '<td class="Doniza_muted">' + esc(s.nis) + '</td>' +
          '<td class="Doniza_strong">' + esc(s.nama) + '</td>' +
          '<td>' + esc(kls ? kls.nama : '-') + '</td>' +
          '<td>' +
          '<select class="Doniza_status_select Doniza_s_hadir">' +
          '<option value="Hadir">Hadir</option>' +
          '<option value="Izin">Izin</option>' +
          '<option value="Sakit">Sakit</option>' +
          '<option value="Alpha">Alpha</option>' +
          '</select>' +
          '</td>';
        tbody.insertBefore(tr, emptyRow);
      });
    }

    function apply() {
      filterTable(tbody, function (tr) { return tr.dataset.kelas === selKelas.value; });
    }

    function loadStatus() {
      var idx = TANGGAL.indexOf(tgl.value);
      $$('tr[data-row]', tbody).forEach(function (tr) {
        var sel = $('select', tr);
        var rec = ABSENSI[tr.dataset.nis];
        var code = (idx > -1 && rec && rec.charAt(idx)) ? rec.charAt(idx) : 'H';
        sel.value = STATUS_NAMA[code] || 'Hadir';
        paintStatus(sel);
      });
    }

    function refreshKelas() {
      setOptions(selKelas, kelasItems(kelasOf(getPill(pills))), null);
      apply();
    }

    rebuildAbsensiRows();
    tgl.value = todayISO();
    initPills(pills, refreshKelas);
    selKelas.addEventListener('change', apply);
    tgl.addEventListener('change', loadStatus);

    tbody.addEventListener('change', function (e) {
      if (e.target.classList.contains('Doniza_status_select')) paintStatus(e.target);
    });

    $('#Doniza_btnSimpan').addEventListener('click', function () {
      var tanggalDipilih = tgl.value;
      if (!tanggalDipilih) {
        showAlert('error', 'Pilih tanggal absensi terlebih dahulu.');
        return;
      }

      var idx = TANGGAL.indexOf(tanggalDipilih);
      if (idx === -1) {
        TANGGAL.push(tanggalDipilih);
        idx = TANGGAL.length - 1;
        // Pad rekaman siswa lain dengan 'H' agar panjang string sejajar dengan indeks TANGGAL
        SISWA.forEach(function (s) {
          var r = ABSENSI[s.nis] || '';
          while (r.length < idx) r += 'H';
          ABSENSI[s.nis] = r + 'H';
        });
        DB.save('tanggal', TANGGAL);
      }

      // Simpan status tiap siswa di kelas yang sedang dibuka
      $$('tr[data-row]', tbody).forEach(function (tr) {
        if (tr.dataset.kelas !== selKelas.value) return;
        var nis = tr.dataset.nis;
        var kode = NAMA_STATUS[$('select', tr).value] || 'H';
        var rec = ABSENSI[nis] || '';
        while (rec.length <= idx) rec += 'H';
        ABSENSI[nis] = rec.substring(0, idx) + kode + rec.substring(idx + 1);
      });

      DB.save('absensi', ABSENSI);

      var kls = byId(KELAS, selKelas.value);
      showAlert('success', 'Absensi kelas ' + (kls ? kls.nama : '') + ' tanggal ' + tanggalDipilih + ' berhasil disimpan.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    refreshKelas();
    loadStatus();
  }

  /* =========================================================
     NILAI (Tersinkronisasi dengan LocalStorage)
     ========================================================= */
  function hitungRata(t, u, a) {
    return Math.round(((+t + +u + +a) / 3) * 100) / 100;
  }

  function initNilai() {
    var tbody = $('#Doniza_tbodyNilai');
    var pills = $('#Doniza_pillsJurusan');
    var selKelas = $('#Doniza_selKelas');
    var selMapel = $('#Doniza_selMapel');
    var selSem = $('#Doniza_selSemester');
    var modal = $('#Doniza_formModal');
    var form = $('#Doniza_formNilai');
    var editing = null;

    setOptions(selMapel, MAPEL.map(function (m) { return { v: m.id, t: m.nama }; }), '-- Semua Mapel --');
    setOptions(selSem, SEMESTER.map(function (s) { return { v: s, t: s }; }), '-- Semua Semester --');

    // Bangun ulang tabel nilai langsung dari array NILAI di LocalStorage
    function rebuildNilaiTable() {
      var emptyRow = $('.Doniza_empty_row', tbody);
      $$('tr[data-row]', tbody).forEach(function (tr) { tr.remove(); });

      NILAI.forEach(function (r, idx) {
        var nis = r[0];
        var mapelId = r[1];
        var semester = r[2];
        var tugas = r[3];
        var uts = r[4];
        var uas = r[5];

        var siswa = null;
        for (var i = 0; i < SISWA.length; i++) {
          if (SISWA[i].nis === nis) { siswa = SISWA[i]; break; }
        }
        if (!siswa) return;

        var mp = byId(MAPEL, mapelId);
        var mapelNama = mp ? mp.nama : '-';
        var rata = hitungRata(tugas, uts, uas);

        var tr = document.createElement('tr');
        tr.setAttribute('data-row', '');
        tr.dataset.nilaiIdx = String(idx);
        tr.dataset.nis = nis;
        tr.dataset.nama = siswa.nama;
        tr.dataset.kelas = String(siswa.kelas);
        tr.dataset.mapel = String(mapelId);
        tr.dataset.mapelNama = mapelNama;
        tr.dataset.semester = semester;
        tr.dataset.tugas = String(tugas);
        tr.dataset.uts = String(uts);
        tr.dataset.uas = String(uas);

        tr.innerHTML =
          '<td class="Doniza_text_center Doniza_muted"></td>' +
          '<td class="Doniza_muted">' + esc(nis) + '</td>' +
          '<td class="Doniza_strong">' + esc(siswa.nama) + '</td>' +
          '<td>' + esc(mapelNama) + '</td>' +
          '<td>' + esc(semester) + '</td>' +
          '<td class="Doniza_text_center">' + tugas + '</td>' +
          '<td class="Doniza_text_center">' + uts + '</td>' +
          '<td class="Doniza_text_center">' + uas + '</td>' +
          '<td class="Doniza_text_center Doniza_strong">' + rata + '</td>' +
          '<td><div class="Doniza_actions">' +
          '<button type="button" class="Doniza_btn_icon Doniza_btn_edit Doniza_js_edit" title="Edit Nilai"><i class="fa-solid fa-pen"></i></button>' +
          '</div></td>';

        tbody.insertBefore(tr, emptyRow);
      });
    }

    function apply() {
      filterTable(tbody, function (tr) {
        var d = tr.dataset;
        if (d.kelas !== selKelas.value) return false;
        if (selMapel.value && d.mapel !== selMapel.value) return false;
        if (selSem.value && d.semester !== selSem.value) return false;
        return true;
      });
    }

    function refreshKelas() {
      setOptions(selKelas, kelasItems(kelasOf(getPill(pills))), null);
      apply();
    }

    function previewAvg() {
      var f = form.elements;
      $('#Doniza_avgPreview').textContent = hitungRata(f.tugas.value || 0, f.uts.value || 0, f.uas.value || 0);
    }

    rebuildNilaiTable();
    initPills(pills, refreshKelas);
    selKelas.addEventListener('change', apply);
    selMapel.addEventListener('change', apply);
    selSem.addEventListener('change', apply);
    ['tugas', 'uts', 'uas'].forEach(function (n) { form.elements[n].addEventListener('input', previewAvg); });

    tbody.addEventListener('click', function (e) {
      var btn = e.target.closest('.Doniza_js_edit');
      if (!btn) return;
      editing = btn.closest('tr');
      var d = editing.dataset;
      form.elements.nama.value = d.nama;
      form.elements.mapel.value = d.mapelNama;
      form.elements.semester.value = d.semester;
      form.elements.tugas.value = d.tugas;
      form.elements.uts.value = d.uts;
      form.elements.uas.value = d.uas;
      previewAvg();
      openModal(modal);
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = form.elements;
      var semVal = f.semester.value.trim();
      var tugasVal = Number(f.tugas.value);
      var utsVal = Number(f.uts.value);
      var uasVal = Number(f.uas.value);
      var rata = hitungRata(tugasVal, utsVal, uasVal);

      // Perbarui array NILAI dan simpan ke LocalStorage
      var idx = Number(editing.dataset.nilaiIdx);
      if (NILAI[idx]) {
        NILAI[idx][2] = semVal;
        NILAI[idx][3] = tugasVal;
        NILAI[idx][4] = utsVal;
        NILAI[idx][5] = uasVal;
        DB.save('nilai', NILAI);
      }

      editing.dataset.semester = semVal;
      editing.dataset.tugas = tugasVal;
      editing.dataset.uts = utsVal;
      editing.dataset.uas = uasVal;
      editing.cells[4].textContent = semVal;
      editing.cells[5].textContent = tugasVal;
      editing.cells[6].textContent = utsVal;
      editing.cells[7].textContent = uasVal;
      editing.cells[8].textContent = rata;

      closeModal(modal);
      apply();
      showAlert('success', 'Nilai ' + editing.dataset.nama + ' berhasil diperbarui secara permanen.');
    });

    refreshKelas();
  }

  /* =========================================================
     INPUT NILAI (Simpan nilai baru ke LocalStorage)
     ========================================================= */
  function initInputNilai() {
    var form = $('#Doniza_formInputNilai');
    var selSiswa = $('#Doniza_selectSiswa');
    var selKelas = $('#Doniza_selectKelas');
    var selMapel = $('#Doniza_selectMapel');

    setOptions(selSiswa, SISWA.map(function (s) { return { v: s.nis, t: s.nama + ' (' + s.nis + ')' }; }), '-- Pilih Siswa --');
    setOptions(selKelas, kelasItems(KELAS), '-- Pilih Kelas --');
    setOptions(selMapel, MAPEL.map(function (m) { return { v: m.id, t: m.nama }; }), '-- Pilih Mata Pelajaran --');

    selSiswa.addEventListener('change', function () {
      for (var i = 0; i < SISWA.length; i++) {
        if (SISWA[i].nis === selSiswa.value) { selKelas.value = SISWA[i].kelas; return; }
      }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = form.elements;
      var nis = selSiswa.value;
      var mapelId = Number(selMapel.value);
      var semester = f.semester ? f.semester.value.trim() : SEMESTER[0];
      var tugas = Number(f.tugas.value);
      var uts = Number(f.uts.value);
      var uas = Number(f.uas.value);

      // Cek apakah kombinasi (nis, mapelId, semester) sudah ada; jika ada update, jika belum tambah baru
      var foundIdx = -1;
      for (var i = 0; i < NILAI.length; i++) {
        if (NILAI[i][0] === nis && Number(NILAI[i][1]) === mapelId && NILAI[i][2] === semester) {
          foundIdx = i;
          break;
        }
      }

      if (foundIdx > -1) {
        NILAI[foundIdx] = [nis, mapelId, semester, tugas, uts, uas];
      } else {
        NILAI.push([nis, mapelId, semester, tugas, uts, uas]);
      }
      DB.save('nilai', NILAI);

      var nama = selSiswa.options[selSiswa.selectedIndex].text;
      var rata = hitungRata(tugas, uts, uas);
      showAlert('success', 'Sukses! Nilai ' + nama + ' berhasil disimpan ke penyimpanan lokal (rata-rata ' + rata + ').');
      form.reset();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* =========================================================
     FILTER LAPORAN (absensi & nilai)
     ========================================================= */
  function initLaporanFilter(jenis) {
    var input = $('#Doniza_pilihSiswa');
    var list = $('#Doniza_daftarSiswa');
    var map = {};

    SISWA.forEach(function (s) {
      var kls = byId(KELAS, s.kelas);
      var label = '[' + (kls ? kls.nama : '-') + '] ' + s.nis + ' - ' + s.nama;
      map[label] = s.nis;
      var o = document.createElement('option');
      o.value = label;
      list.appendChild(o);
    });

    function cariNis() {
      var v = input.value.trim();
      if (map[v]) return map[v];
      for (var i = 0; i < SISWA.length; i++) if (SISWA[i].nis === v) return v;
      return '';
    }

    if (jenis === 'nilai') {
      var cakupan = $('#Doniza_cakupan_semester');
      var boxTa = $('#Doniza_box_ta');
      cakupan.addEventListener('change', function () { boxTa.hidden = cakupan.value === 'semua'; });
      boxTa.hidden = cakupan.value === 'semua';
    }

    $('#Doniza_btnCetak').addEventListener('click', function () {
      var nis = cariNis();
      if (!nis) {
        alert(jenis === 'nilai'
          ? 'Harap pilih salah satu siswa terlebih dahulu!'
          : 'Harap pilih salah satu siswa terlebih dahulu sebelum mencetak!');
        return;
      }
      var url;
      if (jenis === 'nilai') {
        url = 'print_nilai.html?nis=' + encodeURIComponent(nis) +
          '&semester=' + $('#Doniza_cakupan_semester').value +
          '&ta=' + encodeURIComponent($('#Doniza_tahun_ajaran').value);
      } else {
        url = 'print_absensi.html?nis=' + encodeURIComponent(nis) +
          '&semester=' + $('#Doniza_semester').value +
          '&ta=' + encodeURIComponent($('#Doniza_tahun_ajaran').value);
      }
      window.open(url, '_blank');
    });
  }

  /* =========================================================
     KONTAK
     ========================================================= */
  function initKontak() {
    var form = $('#Doniza_formKontak');
    var pesan = $('#Doniza_kPesan');
    var hitung = $('#Doniza_kHitung');
    var MAX = 500;
    var EMAIL_TUJUAN = 'info@sman10tasikmalaya.sch.id';

    function updateHitung() { hitung.textContent = pesan.value.length + ' / ' + MAX; }

    function setError(name, msg) {
      var box = $('[data-error-for="' + name + '"]', form);
      var input = form.elements[name];
      if (box) { box.textContent = msg || ''; box.hidden = !msg; }
      if (input) input.classList.toggle('Doniza_invalid', !!msg);
    }

    function validasi() {
      var f = form.elements;
      var err = {};
      if (f.nama.value.trim().length < 3) err.nama = 'Nama minimal 3 karakter.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.value.trim())) err.email = 'Format email tidak valid.';
      if (!f.subjek.value) err.subjek = 'Pilih salah satu keperluan.';
      if (f.pesan.value.trim().length < 10) err.pesan = 'Pesan minimal 10 karakter.';
      ['nama', 'email', 'subjek', 'pesan'].forEach(function (n) { setError(n, err[n]); });
      return err;
    }

    pesan.addEventListener('input', updateHitung);
    ['nama', 'email', 'subjek', 'pesan'].forEach(function (n) {
      form.elements[n].addEventListener('input', function () { setError(n, ''); });
    });
    form.addEventListener('reset', function () {
      setTimeout(function () {
        ['nama', 'email', 'subjek', 'pesan'].forEach(function (n) { setError(n, ''); });
        updateHitung();
      }, 0);
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var err = validasi();
      var pertama = ['nama', 'email', 'subjek', 'pesan'].filter(function (n) { return err[n]; })[0];
      if (pertama) {
        form.elements[pertama].focus();
        showAlert('error', 'Gagal! Periksa kembali isian yang ditandai merah.');
        return;
      }
      var f = form.elements;
      var judul = '[Website Sekolah] ' + f.subjek.value + ' - ' + f.nama.value.trim();
      var isi = 'Nama: ' + f.nama.value.trim() + '\nEmail: ' + f.email.value.trim() +
        '\nKeperluan: ' + f.subjek.value + '\n\n' + f.pesan.value.trim();
      var url = 'mailto:' + EMAIL_TUJUAN + '?subject=' + encodeURIComponent(judul) + '&body=' + encodeURIComponent(isi);
      showAlert('success', 'Terima kasih, ' + f.nama.value.trim() + '! Pesan Anda siap dikirim lewat aplikasi email.');
      form.reset();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      window.location.href = url;
    });

    updateHitung();
  }

  /* =========================================================
     LOGIN
     ========================================================= */
  function initLogin() {
    var form = $('#Doniza_formLogin');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var user = form.elements.username ? form.elements.username.value.trim() : 'Admin';
      localStorage.setItem('doniza_sikolah_user', user || 'Admin');
      window.location.href = 'index.html';
    });
  }

  /* ---------- Jalankan sesuai halaman ---------- */
  var page = document.body.getAttribute('data-page');
  var routes = {
    login: initLogin,
    kontak: initKontak,
    dashboard: initDashboard,
    siswa: initSiswa,
    guru: initGuru,
    jadwal: initJadwal,
    absensi: initAbsensi,
    nilai: initNilai,
    input_nilai: initInputNilai,
    laporan_absensi: function () { initLaporanFilter('absensi'); },
    laporan_nilai: function () { initLaporanFilter('nilai'); }
  };
  if (routes[page]) routes[page]();
})();
