---
name: create-survery-05-03
description: Tạo mới workbook Survey 05 từ template cho từng bảng hoặc view, điền sheet 03-COLUMNS theo cú pháp Oracle Database 26 từ DDL và nguồn mô tả, xử lý tuần tự và giữ nguyên nguồn.
metadata:
  short-description: Tạo workbook từ DDL và điền 03-COLUMNS
---

# Tạo mới workbook Survey 05 từ DDL

Skill này dùng khi người dùng yêu cầu tạo mới một hoặc nhiều workbook theo template `assets/survey-05-phan-tich-du-lieu-03-danh-sach-field-template.xlsx` và điền sheet `03-COLUMNS` từ DDL, data dictionary, mẫu dữ liệu đã che hoặc tài liệu PII.

## Bối cảnh nghiệp vụ

Đây là khảo sát metadata dữ liệu dành cho ngành hàng không. Bối cảnh này định hướng cách chọn thuật ngữ và diễn giải nghiệp vụ, nhưng không xác nhận trước domain của từng field; mọi mô tả vẫn phải dựa trên bằng chứng từ tên bảng, tên field, dữ liệu mẫu, quan hệ và tài liệu liên quan.

Đây là workflow tạo mới. Không dùng workbook Survey 05 đã có dữ liệu làm nguồn để sửa, không sao chép nội dung từ workbook cũ sang workbook mới và không ghi đè file nguồn. Mỗi bảng hoặc view tạo thành một workbook riêng theo quy ước của template.

## Cấu trúc thư mục skill

```text
create-survery-05-03/
├── SKILL.md
├── scripts/
│   └── create_survey_workbooks.mjs
├── assets/
│   └── survey-05-phan-tich-du-lieu-03-danh-sach-field-template.xlsx
├── sources/
│   ├── DDL-REVERA-revera-owner.sql
│   ├── DDL-REVERA-apex-owner-APEX.sql
│   └── DDL-2filethieu-- IIPS_OWNER.TTPIC_BILLING_AUDIT_T.sql
├── references/
│   ├── logic-pii.md
│   ├── semantic-field-description.md
│   └── Quy tắc bảo vệ Airline PII - Masking & Encryption.md
└── outputs/
    ├── batch-report.csv  # được tạo khi chạy skill
    └── inspect/          # chứa các file *.xlsx.inspect.ndjson của Artifact Tool
```

Các file trong `assets/`, `sources/` và `references/` là nguồn bundled của skill. Thư mục `outputs/` là nơi nhận kết quả tạo mới và không dùng làm nguồn đầu vào.

## Input

Đầu vào gồm:

1. Template workbook bundled with skill:

   `assets/survey-05-phan-tich-du-lieu-03-danh-sach-field-template.xlsx`

2. Một hoặc nhiều file DDL, ví dụ:

   - `sources/DDL-REVERA-revera-owner.sql`
   - `sources/DDL-REVERA-apex-owner-APEX.sql`
   - `sources/DDL-2filethieu-- IIPS_OWNER.TTPIC_BILLING_AUDIT_T.sql`

3. Danh sách bảng/view cần tạo. Nếu người dùng yêu cầu xử lý toàn bộ DDL thì dùng toàn bộ block `CREATE TABLE` hoặc `CREATE VIEW` sau khi loại bỏ đối tượng trùng và ghi rõ phạm vi trong báo cáo. Không tự xử lý toàn bộ DDL chỉ vì file DDL chứa nhiều bảng.
4. Nguồn bổ sung nếu có:

   - tài liệu mô tả field hoặc `Description.csv`;
   - tài liệu liên quan mô tả domain, bảng, quy trình hoặc data element để đối chiếu và suy luận có căn cứ;
   - mẫu dữ liệu đã che;
   - `references/logic-pii.md`;
   - `references/semantic-field-description.md` để áp dụng quy tắc mô tả semantic trong context khảo sát dữ liệu ngành hàng không;
   - `references/Quy tắc bảo vệ Airline PII - Masking & Encryption.md`;
   - danh mục 15 loại PII trong sheet `05-LOAI-PII` của template;
   - xác nhận của DBA hoặc SME.

5. Thư mục output. Nếu người dùng không chỉ định, dùng `outputs/` trong thư mục skill và tạo `outputs/batch-report.csv`.

Trước khi phân tích hoặc tạo bất kỳ workbook nào, phải xác định toàn bộ phạm vi file đầu vào. Nếu người dùng chỉ định một thư mục tài liệu, mọi file đọc được trong thư mục đó là input, ngoại trừ thư mục output, `.git`, `node_modules` và các file sinh ra trong quá trình chạy. Nếu người dùng truyền các file rời, phải đọc đủ từng file đã truyền và các file tham chiếu được dùng bởi workflow.

Nếu schema hoặc tên bảng/view chưa được xác định, không tự chọn đối tượng đầu tiên trong DDL. Hãy ghi câu hỏi cần xác nhận và dừng đối tượng chưa xác định.

Script hỗ trợ nằm tại `scripts/create_survey_workbooks.mjs`. Khi chạy từ thư mục skill, script tự dùng template trong `assets/` và ba file DDL trong `sources/`. Script nhận một hoặc nhiều `--ddl`, một hoặc nhiều `--object SCHEMA.TABLE`, hoặc `--all` khi người dùng đã yêu cầu xử lý toàn bộ DDL:

```bash
node scripts/create_survey_workbooks.mjs \
  --object REVERA_OWNER.AOS_MASTER \
  --object APEX_OWNER.CODE_SHARE_MASTER \
  --output-dir outputs
```

Có thể truyền `--description-csv <file.csv>` nếu CSV có các cột nhận diện được như `schema`, `table`, `column`, `description`, `sample`, `default`, `pii`, `pii_type`, `masking` và `notes`. Script chỉ tự động trích xuất cấu trúc `CREATE TABLE`; view hoặc tài liệu PII phức tạp cần được xác minh bổ sung theo các quy tắc phía dưới.

Có thể truyền thêm một hoặc nhiều `--sample-data <file.csv|file.json>` để cung cấp data mẫu đã che. CSV dạng bảng dùng tên cột DDL làm header; JSON dùng mảng object hoặc object có dạng `{ "schema": "...", "table": "...", "rows": [...] }`. Khi xử lý nhiều bảng, data mẫu nên có `schema` và `table` để gắn đúng đối tượng. Nếu không có metadata định danh, chỉ áp dụng cho lần chạy có đúng một `--object`.

Runtime phải cung cấp `@oai/artifact-tool`. Nếu không dùng module resolution mặc định, đặt `OAI_ARTIFACT_TOOL_PATH` trỏ tới thư mục package `@oai/artifact-tool` trước khi chạy script. Có thể truyền `--template` và `--ddl` để dùng nguồn bên ngoài các file bundled.

## 0. File review bắt buộc trước khi phân tích

Đây là checkpoint bắt buộc và phải hoàn thành trước khi xác định bảng/view, đọc block DDL, suy luận field, điền `Ghi chú` hoặc tạo output.

Quy trình phải xử lý từng file một, theo thứ tự ổn định:

1. Lập danh sách toàn bộ file trong phạm vi input và loại rõ file output, file tạm, file hệ thống hoặc thư mục phụ thuộc không thuộc phạm vi.
2. Mở và đọc toàn bộ nội dung có thể đọc được của file hiện tại.
3. Ghi nhận tối thiểu tên file, loại file, trạng thái đọc, phạm vi nội dung đã đọc và các bằng chứng có thể dùng cho bảng/field.
4. Chuyển sang file kế tiếp chỉ sau khi hoàn tất file hiện tại.
5. Chỉ sau file cuối cùng mới tổng hợp, cross-check, phân tích DDL và tạo workbook.

Trong giai đoạn đọc file:

- không kết luận PK/FK, nullable, PII, mô tả nghiệp vụ hoặc conflict;
- không chọn một file làm nguồn chính rồi dùng các file khác chỉ để bổ sung;
- không tạo workbook, `batch-report.csv` hoàn chỉnh hoặc dữ liệu đầu ra khi chưa có checkpoint `YES`;
- file không đọc được phải được ghi rõ tên và lỗi, không được âm thầm bỏ qua;
- đọc được byte của file không thay thế cho việc đọc nội dung có cấu trúc; PDF, spreadsheet, JSON, CSV, Markdown và SQL phải được dùng bộ đọc phù hợp để kiểm tra toàn bộ nội dung.

Sau file cuối cùng phải ghi checkpoint theo đúng dạng sau vào `outputs/file-review-checkpoint.txt` và đưa đường dẫn vào báo cáo:

```text
FILE REVIEW CHECKPOINT

Total input files: <number>
Files processed: <number>
Successfully read: <number>
Unreadable files: <number>
Skipped files: 0

All accessible files have been reviewed: YES/NO
```

Chỉ được tiếp tục khi `All accessible files have been reviewed: YES`. Nếu là `NO`, dừng trước bước phân tích và không tạo workbook.

## 1. Yêu cầu, hướng dẫn

### 1.1. Tạo workbook mới

Đối với từng bảng/view trong phạm vi:

1. Đọc template bằng workflow spreadsheet và tạo một bản sao mới từ template.
2. Giữ nguyên toàn bộ các sheet, nội dung, style, merge cells, độ rộng cột, chiều cao dòng, freeze panes, filter, data validation, gridlines, tab color, page setup và thiết lập sheet của template.
3. Không cần so sánh với workbook nguồn cũ và không thêm sheet từ workbook khác. Workbook mới phải có các sheet theo template, gồm `01-GUIDE`, `02-ID`, `03-COLUMNS`, `04-CDC-SCD`, `05-LOAI-PII`.
4. Chỉ cập nhật sheet `03-COLUMNS` trong phạm vi yêu cầu hiện tại. Không tự điền `02-ID`, `04-CDC-SCD` hoặc nội dung danh mục `05-LOAI-PII` nếu người dùng không yêu cầu.
5. Đặt tên file:

   `survey-05-phan-tich-du-lieu-03-{SCHEMA}.{TEN_BANG_HOAC_VIEW}.xlsx`

   Giữ nguyên chữ hoa/chữ thường của schema và tên bảng nếu hệ thống file cho phép. Nếu tên có ký tự không hợp lệ, chỉ chuẩn hóa ký tự tên file và ghi tên đối tượng thật trong báo cáo.
6. Nếu output đã tồn tại, không ghi đè. Ghi `skipped` trong báo cáo và chuyển sang đối tượng kế tiếp.

### 1.2. Xử lý tuần tự

Khi xử lý nhiều đối tượng, sắp xếp ổn định theo `schema` rồi tên bảng/view tăng dần và xử lý từng đối tượng một. Không chạy song song và không chuyển sang đối tượng kế tiếp trước khi hoàn thành:

1. xác định block DDL và nguồn tham chiếu;
2. tạo workbook mới từ template;
3. điền `03-COLUMNS`;
4. lưu output;
5. mở lại output để kiểm tra;
6. ghi đúng một dòng vào `outputs/batch-report.csv`;
7. giải phóng workbook hiện tại.

Lỗi của một đối tượng không được làm mất báo cáo hoặc dừng các đối tượng độc lập khác. Conflict datatype vẫn phải tạo workbook và ghi cảnh báo ở `Conflicts`/`Questions`; chỉ ghi `error` hoặc `conflict` khi không thể xác định đối tượng, đọc nguồn hoặc export workbook.

Khi số field vượt quá 80 dòng mẫu của template, phải ghi values cho phần dòng mẫu trước, sau đó copy dòng mẫu cuối sang từng dòng mở rộng và ghi values riêng cho từng dòng mở rộng. Vì `copyTo(..., "all")` không giữ style ổn định cho dòng ngoài vùng template trong Artifact Tool, phải áp dụng explicit format cho `A` và `B:P` của toàn bộ dòng mở rộng trước khi áp dụng validation/autofit; kiểm tra style tại dòng cuối mẫu và dòng mở rộng đầu tiên trước khi bàn giao.

### 1.3. Đọc nguồn DDL

Đọc toàn bộ block `CREATE TABLE` hoặc `CREATE VIEW` của đúng schema và đúng tên đối tượng. Từ DDL, trích xuất:

- tên cột và thứ tự cột;
- kiểu dữ liệu nguyên bản, gồm độ dài, precision và scale;
- default expression;
- `PRIMARY KEY`, `UNIQUE`, `FOREIGN KEY`, `CHECK`;
- cột tham gia khóa composite;
- bảng và cột được tham chiếu;
- thông tin index khi cần đối chiếu, nhưng không coi index là constraint.

Khi trích xuất kiểu dữ liệu, phải tách riêng `kiểu gốc từ DDL` và `kiểu ghi vào cột C`. Cột C là metadata đích cho Oracle Database 26, không phải bản sao nguyên văn của biểu thức DDL.

### 1.3.1. Chuẩn hóa `C - Kiểu dữ liệu` theo Oracle Database 26

Quy tắc này dựa trên tài liệu Oracle Database 26 chính thức: [SQL Language Reference — Data Types](https://docs.oracle.com/en/database/oracle/oracle-database/26/sqlrf/Data-Types.html), [SQL Language Quick Reference — Data Types](https://docs.oracle.com/en/database/oracle/oracle-database/26/sqlqr/Data-Types.html) và [MAX_STRING_SIZE](https://docs.oracle.com/en/database/oracle/oracle-database/26/refrn/MAX_STRING_SIZE.html). Không suy đoán từ phiên bản Oracle cũ.

1. Giữ nguyên biểu thức kiểu gốc trong bằng chứng xử lý. Chỉ đưa kiểu đã chuẩn hóa vào cột C. Khi kiểu C khác DDL gốc, ghi trong audit/report: `Kiểu dữ liệu gốc từ DDL: <gốc>; kiểu Oracle Database 26 trong C: <đích>; áp dụng CEIL(<n> × 1.2)` hoặc nêu rõ lý do chuẩn hóa alias; không đưa provenance kiểu dữ liệu vào `P - Ghi chú`.
2. Chỉ chuẩn hóa alias khi bảng ánh xạ Oracle Database 26 xác nhận tương đương ngữ nghĩa, ví dụ `CHARACTER(n)` → `CHAR(n)`, `VARCHAR(n)`/`CHARACTER VARYING(n)`/`CHAR VARYING(n)` → `VARCHAR2(n)`, `NATIONAL CHARACTER(n)`/`NATIONAL CHAR(n)` → `NCHAR(n)`, `NATIONAL CHARACTER VARYING(n)`/`NATIONAL CHAR VARYING(n)`/`NCHAR VARYING(n)` → `NVARCHAR2(n)`, `NUMERIC`/`DECIMAL` → `NUMBER`, `INTEGER`/`INT`/`SMALLINT` → `NUMBER(38)`, `DOUBLE PRECISION` → `FLOAT(126)` và `REAL` → `FLOAT(63)`. Không tự tạo alias hoặc kiểu mới.
3. Với `CHAR(n)`, `VARCHAR2(n)`, `NCHAR(n)` và `NVARCHAR2(n)`, tính đúng một lần từ giới hạn nguyên bản đã đọc trong DDL:

   `giới hạn_mới = CEIL(giới_hạn_gốc × 1.2)`

   Giữ nguyên `BYTE` hoặc `CHAR` của DDL đối với `CHAR`/`VARCHAR2`. `NCHAR` và `NVARCHAR2` luôn dùng độ dài ký tự theo cú pháp Oracle Database 26; nếu DDL gắn `BYTE` hoặc `CHAR` cho hai kiểu national-character này thì không tự sửa, phải ghi `conflict`/`error`, giữ kiểu gốc và hỏi xác nhận.
4. Các ví dụ bắt buộc: `VARCHAR2(20)` → `VARCHAR2(24)`, `VARCHAR2(20 CHAR)` → `VARCHAR2(24 CHAR)`, `VARCHAR2(20 BYTE)` → `VARCHAR2(24 BYTE)`, `CHAR(1)` → `CHAR(2)`, `NCHAR(5)` → `NCHAR(6)`, `NVARCHAR2(10)` → `NVARCHAR2(12)`, `VARCHAR2(1)` → `VARCHAR2(2)`, `1` → `2`, `3` → `4`, `20` → `24`. Không dùng làm tròn gần nhất.
5. Không tăng 20% cho `NUMBER`, `DATE`, `TIMESTAMP`, `CLOB`, `NCLOB`, `BLOB`, `RAW`, `LONG`, các kiểu không có giới hạn ký tự hữu hạn hoặc các thuộc tính precision/scale. `BYTE`, `CHAR`, precision, scale, default, nullable và constraint không được thay đổi ngoài quy tắc độ dài nêu trên.
6. Sau khi tăng, phải kiểm tra giới hạn Oracle Database 26 trong đúng context. `CHAR` không vượt quá 2000; `VARCHAR2` không vượt quá 4000 với `MAX_STRING_SIZE=STANDARD` hoặc 32767 với `EXTENDED`; `NCHAR` không vượt quá giới hạn của national character set; `NVARCHAR2` không vượt quá giới hạn kết hợp của `MAX_STRING_SIZE` và national character set. Khi context chưa được cung cấp, dùng giới hạn bảo thủ hơn để phát hiện conflict, không tự chọn context thuận lợi.
7. Nếu `CEIL(n × 1.2)` vượt giới hạn `STANDARD`, đặt kiểu ghi vào C về giới hạn chuẩn tương ứng của Oracle Database 26, giữ `BYTE` hoặc `CHAR` hợp lệ của DDL và ghi rõ kiểu gốc, kết quả `CEIL` và kiểu đã giới hạn trong audit/report. Ví dụ `VARCHAR2(4000)` → `VARCHAR2(4000)` sau khi `CEIL(4000 × 1.2) = 4800` vượt `STANDARD`; không đổi sang `CLOB` và không bỏ qua workbook.
8. Nếu kiểu vượt cả giới hạn `EXTENDED`, có qualifier không hợp lệ hoặc không xác minh được cú pháp Oracle Database 26, vẫn tạo workbook với kiểu gốc trong C, ghi cảnh báo và câu hỏi xác nhận trong `Conflicts`/`Questions` của report. Không tự đổi sang LOB hoặc kiểu thay thế. Conflict datatype không được làm mất output của đối tượng.
9. Chống tăng lặp: chỉ lấy `n` từ DDL gốc của lần chạy hiện tại. Không đọc giới hạn từ workbook/output trước đó để tính tiếp, không sửa DDL, template hoặc workbook nguồn.

Script phải nhận context Oracle khi cần kiểm tra giới hạn (`MAX_STRING_SIZE` và national character set). Với `STANDARD`, overflow được giới hạn về mức chuẩn và ghi rõ bằng chứng; với conflict datatype còn lại, vẫn tạo workbook với kiểu gốc và ghi conflict/question trong report để xử lý tuần tự không bị dừng.

Nếu có nhiều định nghĩa cùng tên nhưng khác schema, xử lý thành các đối tượng riêng. Nếu hai nguồn mô tả cùng một field mâu thuẫn, không tự chọn; ghi `conflict`, `Questions` và giữ bằng chứng trong `Ghi chú` hoặc báo cáo.

### 1.4. Điền sheet `03-COLUMNS`

Giữ nguyên 16 cột A:P của template:

| Cột | Trường |
|---|---|
| A | STT |
| B | Tên cột |
| C | Kiểu dữ liệu |
| D | Allow Null |
| E | PK/FK |
| F | Bảng FK |
| G | Mô tả |
| H | Giá trị mặc định |
| I | Dữ liệu mẫu |
| J | PII |
| K | Loại PII |
| L | Logic masking/encrypt PII |
| M | Bắt buộc nghiệp vụ |
| N | Công thức tính |
| O | Trạng thái xác nhận |
| P | Ghi chú |

Điền một dòng cho từng cột, đúng thứ tự DDL. Không chỉ điền cột dùng cho KPI. Khi số cột vượt quá dòng mẫu hiện có, thêm dòng bằng cách sao chép style, number format, border, validation và chiều cao dòng của dòng mẫu gần nhất.

Quy tắc từng trường:

- `Tên cột`: giữ nguyên chính tả, chữ hoa/chữ thường và ký tự của DDL. Không dùng tên trong nguồn khác để ghi đè tên cột DDL.
- `Kiểu dữ liệu`: ghi cú pháp Oracle Database 26 sau khi chuẩn hóa alias có bằng chứng và áp dụng một lần `CEIL(n × 1.2)` cho kiểu text hữu hạn được phép. Ví dụ `NUMBER(12,3)`, `VARCHAR2(20)` → `VARCHAR2(24)`, `VARCHAR2(4000)` → `VARCHAR2(4000)` khi kết quả tăng vượt `STANDARD`, `DATE`, `CHAR(1)` → `CHAR(2)`, `CLOB`, `BLOB`, `RAW` hoặc `TIMESTAMP`. Giữ precision, scale, `BYTE`/`CHAR` hợp lệ và các thuộc tính khác; giữ kiểu DDL gốc, kết quả tính và lý do giới hạn trong audit/report khi C đã thay đổi hoặc có conflict, không ghi vào `P - Ghi chú`.
- `Allow Null`: ghi `N` khi DDL khai báo `NOT NULL`, `CHECK (... IS NOT NULL)` hoặc cột là thành viên PK. Ghi `Y` chỉ khi nguồn khai báo rõ cho phép null. Nếu DDL không đủ căn cứ, để trống và ghi câu hỏi nếu cần.
- `PK/FK`: chỉ dùng giá trị có trong dropdown `PK`, `FK`, `PK+FK`. Ghi theo constraint nguồn; áp dụng cho từng cột của khóa composite. Không coi unique index là PK.
- `Bảng FK`: nếu có constraint `REFERENCES`, ghi đúng dạng `SCHEMA.TEN_BANG.TEN_COT`. Nếu không có FK trong DDL, ghi chính xác `Không có`. Không tự đoán bảng/cột đích.
- `Mô tả`: đọc `references/semantic-field-description.md` trước khi điền. Đây là khảo sát metadata dữ liệu trong ngành hàng không, nên ưu tiên thuật ngữ hàng không khi nguồn cung cấp đủ bằng chứng; không mặc định mọi field thuộc một nghiệp vụ cụ thể. Không dịch literal từng token của tên cột. Ưu tiên mô tả trực tiếp từ data dictionary, DDL comment, PDF, Markdown và tài liệu domain; nếu thiếu thì tổng hợp theo tên bảng, tên field, datatype, sample, quan hệ PK/FK và các pattern field có bằng chứng. Mô tả phải trả lời field đại diện cho thông tin nghiệp vụ nào và dùng cho vai trò gì nếu xác định được. Không đưa câu về hình dạng datatype/sample như `dữ liệu mẫu có dạng giá trị số` vào cột này. Không tự mở rộng abbreviation chưa có đủ bằng chứng. Không suy luận thành business rule, công thức, bắt buộc nghiệp vụ, PK/FK hoặc PII. Không chèn tên tài liệu, tên chương, số mục, số trang, tiền tố trích dẫn hoặc câu ghi nguồn vào giá trị cột này. Dịch tiếng Anh sang tiếng Việt nhưng không rút gọn hoặc thay đổi ý nghĩa; giữ nguyên thuật ngữ kỹ thuật. `G. Mô tả` là bắt buộc cho mọi field: không được để trống và không được ghi đúng các placeholder `Chưa rõ` hoặc `Không có`. Khi không có mô tả trực tiếp hoặc bằng chứng chưa đủ để xác định vai trò chi tiết, phải tạo mô tả semantic bảo thủ dựa trên bảng, tên field và kiểu dữ liệu, đồng thời nêu giới hạn xác nhận trong `P. Ghi chú` nếu cần.
- `Giá trị mặc định`: ghi nguyên biểu thức default từ DDL. Nếu không có hoặc chưa xác định được, ghi `Không có` hoặc để trống khi trường bị giới hạn bởi dropdown/template.
- `Dữ liệu mẫu`: ghi tối đa 1–3 giá trị từ `--sample-data` hoặc nguồn description nếu có căn cứ rõ ràng. Nếu không có mẫu, ghi `Không có`. Chỉ dùng dữ liệu mẫu đã che, không lấy dữ liệu production hoặc dữ liệu khách hàng thật.
- `PII`: dùng `Y` hoặc `N` theo quy tắc PII bên dưới. Nếu chưa đủ căn cứ và không có conflict thì ghi `N`, không tự thêm câu mặc định về PII vào `Ghi chú`. Nếu có khả năng PII nhưng nguồn mâu thuẫn hoặc cần quyết định nghiệp vụ, ghi `conflict` và hỏi xác nhận trước khi hoàn tất.
- `Loại PII`: nếu `PII = N`, để trống. Nếu `PII = Y`, chọn đúng một giá trị từ dropdown của sheet `05-LOAI-PII`; không dịch, viết tắt hoặc tự tạo giá trị.
- `Logic masking/encrypt PII`: nếu `PII = N`, ghi `Không áp dụng`. Nếu `PII = Y`, chỉ ghi một cơ chế `Masking` hoặc `Encrypt` theo tài liệu tham chiếu, kèm logic và ví dụ.
- `Bắt buộc nghiệp vụ`: không suy ra từ `NOT NULL`; để trống trong workflow này nếu chưa có xác nhận nghiệp vụ. Chỉ ghi `Y` hoặc `N` khi nguồn nghiệp vụ/SME cung cấp.
- `Công thức tính`: để trống trong workflow này nếu chưa có công thức nghiệp vụ được xác nhận. Không tự tạo công thức từ tên cột hoặc kiểu dữ liệu.
- `Trạng thái xác nhận`: luôn ghi chính xác `Chưa xác nhận` cho dữ liệu mới trích xuất, trừ khi có xác nhận rõ từ DBA/SME.
- `Ghi chú`: giữ ghi chú nghiệp vụ hoặc giới hạn từ nguồn khi có. Không lặp lại description đã đưa vào cột `Mô tả`, không tự thêm các câu mặc định về PII/FK và không chép toàn bộ mẫu hoặc dữ liệu nhạy cảm vào ghi chú. Nếu không có giá trị data mẫu cho field, ghi thêm chính xác `Chưa có dữ liệu`. Ghi thêm `JSON`, `XML`, `CLOB/BLOB`, giới hạn nguồn, xung đột hoặc lý do chưa xác định khi có liên quan. Nếu kết luận bị giới hạn bởi file không đọc được hoặc file chưa được review, ghi rõ tên file và trạng thái; không dùng một câu `Chưa xác minh` chung chung để thay thế bằng chứng.

Các trường văn bản khác có thể dùng `Chưa rõ` khi chưa thể xác định, nhưng `G. Mô tả` không thuộc ngoại lệ này: luôn phải có nội dung semantic khác `Chưa rõ` và `Không có`. Không dùng nhãn suy luận trong `G. Mô tả`; chỉ đưa nội dung semantic đã tổng hợp. Ngoại lệ: `Bắt buộc nghiệp vụ`, `Công thức tính`, `Allow Null`, `PK/FK` và `Loại PII` tuân theo quy tắc riêng ở trên.

### 1.5. Quy tắc PII

Nếu các tài liệu sau được cung cấp, sử dụng đồng thời:

1. `references/logic-pii.md` để đối chiếu field hoặc nhóm field với mapping và logic bảo vệ.
2. `references/Quy tắc bảo vệ Airline PII - Masking & Encryption.md` để xác minh loại PII, mức độ nhạy cảm, ngoại lệ, thuật toán, key, mẫu che và ví dụ.
3. Danh mục 15 loại PII trong sheet `05-LOAI-PII` của `assets/survey-05-phan-tich-du-lieu-03-danh-sach-field-template.xlsx` để kiểm tra tên hợp lệ.
4. Vùng dropdown `'05-LOAI-PII'!$B$6:$B$20` trong workbook template là danh sách giá trị được phép ghi vào `Loại PII`.

Khi mapping PII:

- có thể bỏ qua khác biệt hoa thường, dấu cách, `_` và `-` khi đối chiếu tài liệu, nhưng không thay đổi tên cột trong workbook;
- chỉ map field khác tên khi cùng ý nghĩa được chứng minh bằng tên, description, ngữ cảnh bảng và tài liệu PII;
- ưu tiên mapping field cụ thể và ngoại lệ field-specific hơn quy tắc mặc định;
- khi hai tài liệu mâu thuẫn, ghi `conflict` và hỏi xác nhận;
- không tự tạo mapping hoặc suy luận ngữ cảnh nhạy cảm, ví dụ phân biệt sở thích với thông tin y tế;
- nếu `PII = Y`, chọn đúng một loại PII và một cơ chế bảo vệ;
- không ghi đồng thời `Masking` và `Encrypt`;
- nếu `Masking`, giữ mẫu che và ví dụ từ tài liệu;
- nếu `Encrypt`, giữ nguyên thuật ngữ kỹ thuật như `AES-256-GCM`, `KMS`, `tokenization` và `ciphertext` nếu nguồn có nêu;
- nếu không có logic bảo vệ phù hợp, ghi `Không áp dụng` và nêu giới hạn trong `Ghi chú`.

Nếu không có tài liệu PII, không tự phân loại field từ tên cột đơn lẻ. Data mẫu không được dùng để xác nhận PII hoặc thay thế quyết định nghiệp vụ. Chỉ áp dụng chính sách `PII = N` khi không có conflict; không thêm câu mặc định về PII vào `Ghi chú`.

### 1.6. Validation và báo cáo

Trước khi lưu output:

- dùng Artifact Tool theo workflow spreadsheet;
- render template trước khi tạo để nắm layout;
- sau khi điền, gọi `workbook.recalculate()` một lần;
- kiểm tra vùng đầu, giữa và cuối của `03-COLUMNS`;
- kiểm tra data validation của các dropdown;
- quét các lỗi `#REF!`, `#DIV/0!`, `#VALUE!`, `#N/A`, `#NAME?`, `#NUM!`, `#NULL!`, `#SPILL!`, `#CALC!`;
- render sheet `03-COLUMNS` sau khi điền để kiểm tra không bị cắt chữ, tràn nội dung hoặc mất style;
- quét toàn bộ cột `G. Mô tả`: không được có ô trống, `Chưa rõ`, `Không có` hoặc mô tả chỉ là placeholder; nếu có phải ghi `error` và không bàn giao workbook đó;
- export đúng một file `.xlsx` cho mỗi bảng/view có thể xác định và đọc được; conflict datatype không được bỏ qua file.
- File phụ trợ `*.xlsx.inspect.ndjson` do Artifact Tool tạo phải được chuyển vào thư mục riêng `outputs/inspect/`, không để cạnh workbook trong thư mục output chính.

Tạo `outputs/batch-report.csv` với tối thiểu các cột:

```text
Source DDL
Schema
Object name
Output file
Status
Rows created
Conflicts
Questions
Errors
```

`Status` chỉ dùng:

```text
created
skipped
conflict
error
```

Ghi đúng một dòng ngay sau khi kiểm tra xong từng output. Khi workbook được tạo nhưng có datatype conflict, dùng `created`, ghi chi tiết ở cột `Conflicts` và `Questions`. Cuối workflow báo cáo tổng số đối tượng đã quét, đã tạo, bị bỏ qua, conflict, lỗi, câu hỏi cần xác nhận và đường dẫn output/report.
Ngoài `batch-report.csv`, phải bàn giao `outputs/file-review-checkpoint.txt` với checkpoint đã nêu ở trên.

## 2. Tiêu chí output

Mỗi workbook mới phải đáp ứng các tiêu chí sau:

- được tạo từ template, không phải từ workbook nguồn đã có dữ liệu;
- có đúng các sheet và layout của template;
- có đúng một bảng/view đích;
- số dòng field bằng số cột được xác định từ DDL;
- tên cột và thứ tự khớp nguồn; cột C dùng cú pháp Oracle Database 26 sau chuẩn hóa và tăng một lần theo quy tắc, giới hạn về `STANDARD` khi overflow, còn kiểu DDL gốc, độ dài gốc, độ dài sau `CEIL`, precision, scale, `BYTE`/`CHAR` và default phải có thể đối chiếu qua audit/report khi cần;
- PK/FK và tham chiếu khớp constraint nguồn; unique index không bị ghi nhầm thành PK;
- cột `Bảng FK` ghi `Không có` khi field không có FK trong DDL;
- description được đưa đầy đủ từ nguồn khi có nguồn; nếu không có description trực tiếp thì bắt buộc tổng hợp theo `references/semantic-field-description.md` trong context khảo sát ngành hàng không, không phải phép dịch literal tên cột; mọi dòng phải có `G. Mô tả` semantic khác `Chưa rõ` và `Không có`;
- field không có sample source ghi `Không có`, không tự tạo dữ liệu từ kiểu cột;
- field chưa có data mẫu ghi thêm `Chưa có dữ liệu` trong `Ghi chú`;
- nếu có data mẫu, `Dữ liệu mẫu` nhận tối đa 1–3 giá trị; mẫu được dùng làm bằng chứng hỗ trợ mô tả semantic cùng với tên bảng, tên field, datatype và các field liên quan, nhưng không dùng riêng mẫu để kết luận business rule hoặc PII;
- PII, loại PII và logic bảo vệ tuân thủ tài liệu được cung cấp hoặc được ghi rõ là chưa xác minh; datatype conflict phải được nêu trong `Conflicts`/`Questions`, không được âm thầm bỏ qua workbook;
- `Bắt buộc nghiệp vụ` và `Công thức tính` không bị suy diễn;
- `Trạng thái xác nhận` có giá trị `Chưa xác nhận`;
- dropdown `Loại PII` dùng đúng nguồn `'05-LOAI-PII'!$B$6:$B$20`, không hard-code và không cho nhập tự do thay thế;
- không có dữ liệu PII thật trong workbook mới;
- không có lỗi công thức rõ ràng trong phạm vi kiểm tra;
- output không ghi đè template, DDL hoặc các file nguồn khác.
- thư mục output chính chỉ chứa workbook `.xlsx`, `batch-report.csv`, `file-review-checkpoint.txt` và thư mục `inspect/`; không để file `*.xlsx.inspect.ndjson` ở cấp thư mục chính.

## 3. Sample

Input DDL:

```sql
CREATE TABLE REVERA_OWNER.AOS_MASTER (
    AOS_CODE NUMBER(3,0),
    AOS_NAME VARCHAR2(20),
    REGION_CODE NUMBER(4,0),
    CONSTRAINT AOS_MASTER_PK PRIMARY KEY (AOS_CODE),
    CONSTRAINT SYS_C0011254 CHECK ("AOS_CODE" IS NOT NULL)
);
```

Nếu không có description hoặc sample source, các dòng mới trong `03-COLUMNS` vẫn phải có mô tả semantic bảo thủ dựa trên bảng, tên field và kiểu dữ liệu, không được dùng `Chưa rõ` hoặc `Không có` ở cột `G. Mô tả`:

| STT | Tên cột | Kiểu dữ liệu | Allow Null | PK/FK | Bảng FK | Mô tả | Giá trị mặc định | Dữ liệu mẫu | PII | Loại PII | Logic masking/encrypt PII | Bắt buộc nghiệp vụ | Công thức tính | Trạng thái xác nhận | Ghi chú |
|---:|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | AOS_CODE | NUMBER(3,0) | N | PK | Không có | Mã định danh của bản ghi AOS. | Không có | Không có | N |  | Không áp dụng |  |  | Chưa xác nhận | Chưa có dữ liệu |
| 2 | AOS_NAME | VARCHAR2(24) |  |  | Không có | Tên hiển thị của bản ghi AOS. | Không có | Không có | N |  | Không áp dụng |  |  | Chưa xác nhận | Chưa có dữ liệu |
| 3 | REGION_CODE | NUMBER(4,0) |  |  | Không có | Mã vùng liên kết với bản ghi AOS. | Không có | Không có | N |  | Không áp dụng |  |  | Chưa xác nhận | Chưa có dữ liệu |

Nếu tài liệu description có nội dung, ghi toàn bộ nội dung đã dịch, không rút gọn. Nếu không có description trực tiếp, dùng tên bảng, tên field, datatype và sample để ghi mô tả semantic; nếu vai trò chi tiết vẫn chưa được xác nhận thì mô tả phải nêu đối tượng dữ liệu và trường lưu thông tin đó, còn giới hạn xác nhận ghi ở `P. Ghi chú`. Nếu có sample đã che, dùng tối đa 1–3 giá trị sample đó thay cho `Không có` ở cột `I. Dữ liệu mẫu`, không thay thế yêu cầu bắt buộc của cột `G. Mô tả`.

Ví dụ khi chạy với data mẫu:

```bash
node scripts/create_survey_workbooks.mjs \
  --object REVERA_OWNER.AOS_MASTER \
  --sample-data ./samples/AOS_MASTER.json \
  --output-dir outputs
```

Không biến việc quan sát mẫu `AOS_CODE` thành xác nhận nghiệp vụ; dùng mẫu như bằng chứng cùng với context để ghi phần semantic tương ứng. Chỉ đưa mẫu vào `Dữ liệu mẫu` và ghi `Chưa có dữ liệu` nếu field không có giá trị.

## 4. Nguyên tắc

- Đây là tạo mới, không phải sửa. Không đọc workbook cũ để lấy dữ liệu và không cập nhật workbook nguồn.
- Không tạo workbook cho bảng/view chưa nằm trong phạm vi người dùng yêu cầu.
- Không tự tạo field, kiểu dữ liệu hoặc alias. Kiểu C chỉ được chuẩn hóa theo cú pháp Oracle Database 26 có bằng chứng; default, bảng FK, PII, loại PII, logic bảo vệ, business rule hoặc công thức không được tự tạo. Mô tả được tổng hợp theo reference semantic trong context khảo sát ngành hàng không, khi có căn cứ từ tên bảng, tên trường, datatype, dữ liệu mẫu, quan hệ và tài liệu liên quan.
- Không biến index thành constraint; không biến tên có hậu tố `_id` thành FK nếu chưa có bằng chứng hoặc người dùng chưa bật quy tắc đó rõ ràng.
- Không suy ra `Bắt buộc nghiệp vụ` từ `NOT NULL`.
- Không suy ra PII chỉ từ tên cột. Khi chưa đủ căn cứ, ghi `PII = N` và không thêm câu mặc định vào ghi chú; nếu có conflict thì dừng field bị ảnh hưởng để hỏi xác nhận.
- Không xem đặc điểm quan sát từ data mẫu là xác nhận chức năng, PII, khóa hoặc business rule; mẫu chỉ là một bằng chứng trong việc tổng hợp nội dung semantic của field.
- Không dịch, viết tắt, đổi chính tả hoặc tự tạo giá trị `Loại PII` ngoài dropdown.
- Không ghi đồng thời `Masking` và `Encrypt`.
- Không đưa dữ liệu production, token, mật khẩu, khóa mã hóa hoặc thông tin PII thật vào sample, ghi chú hay báo cáo.
- Không rút gọn description và không thay đổi payload/code/thuật ngữ kỹ thuật.
- Khi nguồn mâu thuẫn, giữ riêng bằng chứng, ghi `conflict` và hỏi xác nhận; không tự chọn một nguồn.
- Với JSON/XML/CLOB/BLOB cần giữ nguyên bản ghi, ghi rõ loại payload trong `Ghi chú`.
- Không đổi cấu trúc, style hoặc nội dung template ngoài phần điền `03-COLUMNS` và việc thêm dòng cần thiết cho đủ số cột.
- Nếu có code hoặc script hỗ trợ, comment chỉ cho nghiệp vụ, thuật toán phức tạp hoặc quyết định kiến trúc; comment phải giải thích tại sao.
- Không đưa thông tin nguồn, chương, trang hoặc citation vào `G. Mô tả`; provenance của việc chuẩn hóa kiểu chỉ nằm trong audit/report, không ghi vào `P - Ghi chú`.
