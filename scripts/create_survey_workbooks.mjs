#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_TEMPLATE = path.join(SKILL_DIR, "assets/survey-05-phan-tich-du-lieu-03-danh-sach-field-template.xlsx");
const DEFAULT_DDL = [
  path.join(SKILL_DIR, "sources/DDL-REVERA-revera-owner.sql"),
  path.join(SKILL_DIR, "sources/DDL-REVERA-apex-owner-APEX.sql"),
  path.join(SKILL_DIR, "sources/DDL-2filethieu-- IIPS_OWNER.TTPIC_BILLING_AUDIT_T.sql"),
];
const DEFAULT_REFERENCE_FILES = [
  path.join(SKILL_DIR, "references/04-bronze.md"),
  path.join(SKILL_DIR, "references/logic-pii.md"),
  path.join(SKILL_DIR, "references/Quy tắc bảo vệ Airline PII - Masking & Encryption.md"),
];
const DEFAULT_OUTPUT_DIR = path.join(SKILL_DIR, "outputs");
const TEMPLATE_SHEET = "01-COL";
const FIRST_DATA_ROW = 6;
const SOURCE_TEMPLATE_DATA_ROWS = 5;
const TECHNICAL_TEMPLATE_FIRST_ROW = FIRST_DATA_ROW + SOURCE_TEMPLATE_DATA_ROWS;
const TEMPLATE_LAST_ROW = TECHNICAL_TEMPLATE_FIRST_ROW + 5;
const BRONZE_TECHNICAL_ROW_COUNT = 6;
// Giới hạn số lần thử để batch không rơi vào vòng lặp chạy lại vô hạn khi resolver vẫn không có đủ bằng chứng semantic.
const MAX_SEMANTIC_DESCRIPTION_ATTEMPTS = 3;
const UNRESOLVED_SEMANTIC_DESCRIPTION = "Field chưa được mô tả";
const TEMPLATE_SHEETS = ["00-META", "01-COL", "02-CDC", "03-LOAD"];
const CURRENT_COLUMNS = [
  "STT", "Tên cột", "Cột Bronze", "Kiểu dữ liệu nguồn", "Kiểu dữ liệu Bronze", "Mô tả", "Mặc định", "Dữ liệu mẫu",
  "Bắt buộc nghiệp vụ", "Công thức tính", "1.2 Format", "1.3 Length", "1.4 Range", "1.5 Domain", "1.6 Allow Null",
  "1.7 Unique", "1.8 RI", "1.9 Consistency", "1.10 Accuracy", "1.11 Timeliness", "CDC/SCD", "2.1 Masking",
  "2.2 Encryption", "2.3 Access", "2.4 Classification", "2.5 Anonymization", "2.6 Pseudonymization", "Khác nguồn", "Xác nhận", "Ghi chú",
];

// Mô tả ưu tiên nguồn trực tiếp; khi thiếu nguồn, được tổng hợp từ tên field, mẫu và ngữ cảnh liên quan.
const DOCUMENT_DESCRIPTIONS = {
  HEADER_RECORD: {
    SOURCE_FILE_NAME: "Trường quản lý nguồn trong schema; tài liệu SSIM Chương 7 mô tả nội dung record nhưng không định nghĩa data element này.",
    RECORD_TYPE: "SSIM Chương 7, mục 7.5.1-7.5.2: Header Record, Record Type 1; giá trị luôn là 1.",
    TITLE_OF_CONTENTS: "SSIM Chương 7, mục 7.5.1-7.5.2: Header Record; nội dung luôn là AIRLINE STANDARD SCHEDULE DATA SET.",
    SPARE_36_40: "SSIM Chương 7, mục 7.5.2: vùng spare, điền khoảng trắng.",
    NUMBER_OF_SEASONS: "SSIM Chương 7, mục 7.5.2: số mùa tiếp theo khi có áp dụng.",
    SPARE_42_191: "SSIM Chương 7, mục 7.5.2: vùng spare, điền khoảng trắng.",
    DATA_SET_SERIAL_NUMBER: "SSIM Chương 7, mục 7.5.2: số serial của data set.",
    RECORD_SERIAL_NUMBER: "SSIM Chương 7, mục 7.5.2: số serial của record.",
    RAW_RECORD: "SSIM Chương 7, mục 7.5.1: Header Record có độ dài chuẩn 200 byte và được chia thành các data element.",
  },
  CARRIER_RECORD: {
    SOURCE_FILE_NAME: "Trường quản lý nguồn trong schema; tài liệu SSIM Chương 7 mô tả nội dung record nhưng không định nghĩa data element này.",
    RECORD_TYPE: "SSIM Chương 7, mục 7.5.2: Carrier Record, Record Type 2; giá trị luôn là 2.",
    TIME_MODE: "SSIM Chương 7, mục 7.5.2: U là UTC, L là Local Time.",
    AIRLINE_DESIGNATOR: "SSIM Chương 7, mục 7.5.2: IATA Airline Designator của carrier có lịch bay trong Carrier/Trailer Record.",
    SPARE_6_10: "SSIM Chương 7, mục 7.5.2: vùng spare, điền khoảng trắng.",
    SEASON: "SSIM Chương 7, mục 7.5.2: vùng Season, tài liệu quy định điền khoảng trắng.",
    SPARE_14: "SSIM Chương 7, mục 7.5.2: vùng spare, điền khoảng trắng.",
    PERIOD_OF_SCHEDULE_VALIDITY: "SSIM Chương 7, mục 7.5.2: ngày đầu và ngày cuối của lịch bay trong Carrier/Trailer Record; định dạng ngày theo Time Mode.",
    CREATION_DATE: "SSIM Chương 7, mục 7.5.2: ngày tạo data set, dạng ngày-tháng-năm.",
    TITLE_OF_DATA: "SSIM Chương 7, mục 7.5.2: nội dung tự do, có thể để trống.",
    RELEASE_SELL_DATE: "SSIM Chương 7, mục 7.5.2: ngày Release/Sell hoặc để trống.",
    SCHEDULE_STATUS: "SSIM Chương 7, mục 7.5.2: trạng thái lịch bay P hoặc C.",
    CREATOR_REFERENCE: "SSIM Chương 7, mục 7.5.2: nội dung tham chiếu tự do, có thể để trống.",
    DUPLICATE_AIRLINE_DESIGNATOR_MARKER: "SSIM Chương 7, mục 7.5.2: vùng đánh dấu duplicate airline designator, điền khoảng trắng.",
    GENERAL_INFORMATION: "SSIM Chương 7, mục 7.5.2: thông tin tự do, có thể để trống.",
    IN_FLIGHT_SERVICE_INFORMATION_DEFAULTS: "SSIM Chương 7, mục 7.5.2: giá trị mặc định theo format của Chapter 2, không bắt buộc DEI 503.",
    ELECTRONIC_TICKETING_INFORMATION: "SSIM Chương 7, mục 7.5.2: EN là không phải ứng viên Electronic Ticketing, ET là ứng viên Electronic Ticketing.",
    CREATION_TIME: "SSIM Chương 7, mục 7.5.2: giờ và phút tạo data set, dạng HHMM.",
    RECORD_SERIAL_NUMBER: "SSIM Chương 7, mục 7.5.2: số serial tăng một so với record trước.",
    RAW_RECORD: "SSIM Chương 7, mục 7.5.2: Carrier Record có độ dài chuẩn 200 byte và mô tả period áp dụng của schedule tiếp theo.",
  },
  FLIGHT_LEG_RECORD: {
    SOURCE_FILE_NAME: "Trường quản lý nguồn trong schema; tài liệu SSIM Chương 7 mô tả nội dung record nhưng không định nghĩa data element này.",
    CARRIER_RECORD_SERIAL_NUMBER: "SSIM Chương 7, mục 7.5.2-7.5.3: Flight Leg Record thuộc block của Carrier Record liền trước.",
    RECORD_TYPE: "SSIM Chương 7, mục 7.5.3: Flight Leg Record, Record Type 3; giá trị luôn là 3.",
    OPERATIONAL_SUFFIX: "SSIM Chương 7, mục 7.5.3: Operational Suffix, có thể để trống.",
    AIRLINE_DESIGNATOR: "SSIM Chương 7, mục 7.5.3: mã airline được lấy theo Airline Designator của Record Type 2.",
    FLIGHT_NUMBER: "SSIM Chương 7, mục 7.5.3: số chuyến bay, căn phải và điền khoảng trắng.",
    ITINERARY_VARIATION_IDENTIFIER: "SSIM Chương 7, mục 7.5.3: số từ 01 đến 99.",
    LEG_SEQUENCE_NUMBER: "SSIM Chương 7, mục 7.5.3: số từ 01 đến 99, liên tục trong từng Itinerary Variation Identifier.",
    SERVICE_TYPE: "SSIM Chương 7, mục 7.5.3: Service Type dạng chữ cái.",
    PERIOD_OF_OPERATION: "SSIM Chương 7, mục 7.5.3: khoảng ngày áp dụng cho Aircraft STD và phải tương thích với Time Mode của Record Type 2.",
    DAYS_OF_OPERATION: "SSIM Chương 7, mục 7.5.3: ngày khai thác; ngày không khai thác được điền khoảng trắng.",
    FREQUENCY_RATE: "SSIM Chương 7, mục 7.5.3: Frequency Rate, vùng này được điền khoảng trắng khi không sử dụng.",
    DEPARTURE_STATION: "SSIM Chương 7, mục 7.5.3: mã IATA 3 ký tự của sân bay khởi hành.",
    SCHEDULED_TIME_OF_PASSENGER_DEPARTURE: "SSIM Chương 7, mục 7.5.3: Passenger STD phải tương thích với Time Mode và phải được điền.",
    SCHEDULED_TIME_OF_AIRCRAFT_DEPARTURE: "SSIM Chương 7, mục 7.5.3: Aircraft STD phải tương thích với Time Mode của Record Type 2.",
    UTC_LOCAL_TIME_VARIATION_DEPARTURE: "SSIM Chương 7, mục 7.5.3: độ lệch giờ và phút so với UTC.",
    PASSENGER_TERMINAL_DEPARTURE: "SSIM Chương 7, mục 7.5.3: terminal dạng chữ-số, căn trái và điền khoảng trắng.",
    ARRIVAL_STATION: "SSIM Chương 7, mục 7.5.3: mã IATA 3 ký tự của sân bay đến.",
    SCHEDULED_TIME_OF_AIRCRAFT_ARRIVAL: "SSIM Chương 7, mục 7.5.3: Aircraft STA phải tương thích với Time Mode của Record Type 2.",
    SCHEDULED_TIME_OF_PASSENGER_ARRIVAL: "SSIM Chương 7, mục 7.5.3: Passenger STA phải tương thích với Time Mode và phải được điền.",
    UTC_LOCAL_TIME_VARIATION_ARRIVAL: "SSIM Chương 7, mục 7.5.3: độ lệch giờ và phút so với UTC.",
    PASSENGER_TERMINAL_ARRIVAL: "SSIM Chương 7, mục 7.5.3: terminal dạng chữ-số, căn trái và điền khoảng trắng.",
    AIRCRAFT_TYPE: "SSIM Chương 7, mục 7.5.3: ATA/IATA Aircraft Type, tham chiếu Appendix A.",
    PASSENGER_RESERVATIONS_BOOKING_DESIGNATOR: "SSIM Chương 7, mục 7.5.3: Passenger Reservations Booking Designator; field này hoặc Aircraft Configuration/Version phải có.",
    PASSENGER_RESERVATIONS_BOOKING_MODIFIER: "SSIM Chương 7, mục 7.5.3: Passenger Reservations Booking Modifier, điền theo class của Booking Designator.",
    MEAL_SERVICE_NOTE: "SSIM Chương 7, mục 7.5.3: Meal Service Note, field tùy chọn.",
    JOINT_OPERATION_AIRLINE_DESIGNATORS: "SSIM Chương 7, mục 7.5.3: Joint Operation Airline Designators; nếu dùng airline designator 2 ký tự thì các vị trí liên quan phải để trống.",
    INTERNATIONAL_DOMESTIC_STATUS: "SSIM Chương 7, mục 7.5.3: trạng thái quốc tế/nội địa dùng tổ hợp D và/hoặc I.",
    SECURE_FLIGHT_INDICATOR: "SSIM Chương 7, mục 7.5.3: S nếu flight leg thuộc phạm vi quy định Secure Flight.",
    SPARE_123_127: "SSIM Chương 7, mục 7.5.3: vùng spare, điền khoảng trắng.",
    ITINERARY_VARIATION_IDENTIFIER_OVERFLOW: "SSIM Chương 7, mục 7.5.3: vùng overflow của Itinerary Variation Identifier.",
    AIRCRAFT_OWNER: "SSIM Chương 7, mục 7.5.3: Aircraft Owner, căn trái và điền khoảng trắng.",
    COCKPIT_CREW_EMPLOYER: "SSIM Chương 7, mục 7.5.3: Cockpit Crew Employer, căn trái và điền khoảng trắng.",
    CABIN_CREW_EMPLOYER: "SSIM Chương 7, mục 7.5.3: Cabin Crew Employer, căn trái và điền khoảng trắng.",
    ONWARD_FLIGHT_AIRLINE_DESIGNATOR: "SSIM Chương 7, mục 7.5.3: Airline Designator của Onward Flight, căn trái và điền khoảng trắng.",
    ONWARD_FLIGHT_NUMBER: "SSIM Chương 7, mục 7.5.3: Flight Number của Onward Flight, căn phải và điền khoảng trắng.",
    AIRCRAFT_ROTATION_LAYOVER: "SSIM Chương 7, mục 7.5.3: Aircraft Rotation Layover, điền khoảng trắng khi không sử dụng.",
    ONWARD_FLIGHT_OPERATIONAL_SUFFIX: "SSIM Chương 7, mục 7.5.3: Operational Suffix của Onward Flight.",
    SPARE_147: "SSIM Chương 7, mục 7.5.3: vùng spare, điền khoảng trắng.",
    FLIGHT_TRANSIT_LAYOVER: "SSIM Chương 7, mục 7.5.3: Flight Transit Layover, điền khoảng trắng khi không sử dụng.",
    OPERATING_AIRLINE_DISCLOSURE: "SSIM Chương 7, mục 7.5.4: Operating Airline Disclosure dùng DEI 2 cho code share hoặc DEI 9 cho shared airline/wet lease.",
    TRAFFIC_RESTRICTION_CODE: "SSIM Chương 7, mục 7.5.4: Traffic Restriction Code, điền khoảng trắng khi không sử dụng.",
    TRAFFIC_RESTRICTION_CODE_LEG_OVERFLOW_INDICATOR: "SSIM Chương 7, mục 7.5.4: chỉ báo overflow của Traffic Restriction Code.",
    SPARE_162_172: "SSIM Chương 7, mục 7.5.4: vùng spare, điền khoảng trắng.",
    AIRCRAFT_CONFIGURATION_VERSION: "SSIM Chương 7, mục 7.5.4: Aircraft Configuration/Version; field này hoặc Passenger Reservations Booking Designator phải có.",
    DATE_VARIATION: "SSIM Chương 7, mục 7.5.4: Date Variation của flight leg.",
    RECORD_SERIAL_NUMBER: "SSIM Chương 7, mục 7.5.4: số serial tăng tuần tự theo record trước, không phụ thuộc Record Type.",
    RAW_RECORD: "SSIM Chương 7, mục 7.5.3: Flight Leg Record có độ dài chuẩn 200 byte và mô tả lịch bay theo từng leg.",
  },
  SEGMENT_DATA_RECORD: {
    SOURCE_FILE_NAME: "Trường quản lý nguồn trong schema; tài liệu SSIM Chương 7 mô tả nội dung record nhưng không định nghĩa data element này.",
    FLIGHT_LEG_RECORD_SERIAL_NUMBER: "SSIM Chương 7, mục 7.5.4: Segment Data Record áp dụng cho một Flight Leg Record duy nhất.",
    RECORD_TYPE: "SSIM Chương 7, mục 7.5.4: Segment Data Record, Record Type 4; giá trị luôn là 4.",
    OPERATIONAL_SUFFIX: "SSIM Chương 7, mục 7.5.4: Operational Suffix, điền khoảng trắng.",
    AIRLINE_DESIGNATOR: "SSIM Chương 7, mục 7.5.4: mã airline theo Airline Designator của Record Type 2.",
    FLIGHT_NUMBER: "SSIM Chương 7, mục 7.5.4: số chuyến bay, căn phải và điền khoảng trắng.",
    ITINERARY_VARIATION_IDENTIFIER: "SSIM Chương 7, mục 7.5.4: số từ 01 đến 99.",
    LEG_SEQUENCE_NUMBER: "SSIM Chương 7, mục 7.5.4: số từ 01 đến 99, liên tục trong từng Itinerary Variation Identifier.",
    SERVICE_TYPE: "SSIM Chương 7, mục 7.5.4: Service Type dạng chữ cái.",
    SPARE_15_27: "SSIM Chương 7, mục 7.5.4: vùng spare, điền khoảng trắng.",
    ITINERARY_VARIATION_IDENTIFIER_OVERFLOW: "SSIM Chương 7, mục 7.5.4: vùng overflow của Itinerary Variation Identifier.",
    BOARD_POINT_INDICATOR: "SSIM Chương 7, mục 7.5.4: Board Point Indicator dạng chữ cái.",
    OFF_POINT_INDICATOR: "SSIM Chương 7, mục 7.5.4: Off Point Indicator dạng chữ cái.",
    DATA_ELEMENT_IDENTIFIER: "SSIM Chương 7, mục 7.5.4: Data Element Identifier, căn phải và điền số 0.",
    BOARD_POINT: "SSIM Chương 7, mục 7.5.4: mã IATA 3 ký tự của Board Point.",
    OFF_POINT: "SSIM Chương 7, mục 7.5.4: mã IATA 3 ký tự của Off Point.",
    DATA: "SSIM Chương 7, mục 7.5.4: dữ liệu gắn với Data Element Identifier; format được định nghĩa tại Chapter 2.",
    RECORD_SERIAL_NUMBER: "SSIM Chương 7, mục 7.5.4: số serial tăng tuần tự theo record trước, không phụ thuộc Record Type.",
    RAW_RECORD: "SSIM Chương 7, mục 7.5.4: Segment Data Record có độ dài chuẩn 200 byte và chứa data gắn với Data Element Identifier.",
  },
  TRAILER_RECORD: {
    SOURCE_FILE_NAME: "Trường quản lý nguồn trong schema; tài liệu SSIM Chương 7 mô tả nội dung record nhưng không định nghĩa data element này.",
    CARRIER_RECORD_SERIAL_NUMBER: "SSIM Chương 7, mục 7.5.5: Trailer Record kết thúc dữ liệu dưới Carrier Record liền trước.",
    RECORD_TYPE: "SSIM Chương 7, mục 7.5.5: Trailer Record, Record Type 5; giá trị luôn là 5.",
    SPARE_2: "SSIM Chương 7, mục 7.5.5: vùng spare, điền khoảng trắng.",
    AIRLINE_DESIGNATOR: "SSIM Chương 7, mục 7.5.5: Airline Designator, căn trái.",
    RELEASE_SELL_DATE: "SSIM Chương 7, mục 7.5.5: Release/Sell Date theo Carrier Record hoặc để trống.",
    SPARE_13_187: "SSIM Chương 7, mục 7.5.5: vùng spare, điền khoảng trắng.",
    SERIAL_NUMBER_CHECK_REFERENCE: "SSIM Chương 7, mục 7.5.5: bằng Record Serial Number của record trước đó và nhỏ hơn serial của Trailer Record một đơn vị.",
    CONTINUATION_END_CODE: "SSIM Chương 7, mục 7.5.5: C hoặc E.",
    RECORD_SERIAL_NUMBER: "SSIM Chương 7, mục 7.5.5: số serial tăng tuần tự theo record trước, không phụ thuộc Record Type.",
    RAW_RECORD: "SSIM Chương 7, mục 7.5.5: Trailer Record có độ dài chuẩn 200 byte và đánh dấu kết thúc block Carrier/Trailer.",
  },
  SSM_MESSAGE: {
    SOURCE_FILE_NAME: "Trường quản lý nguồn trong schema; tài liệu SSIM Chương 4 mô tả cấu trúc SSM nhưng không định nghĩa data element này.",
    MESSAGE_ADDRESS_ORIGINATOR: "SSIM Chương 4: Message Address/Originator theo quy định liên lạc.",
    STANDARD_MESSAGE_IDENTIFIER: "SSIM Chương 4: Message Header chứa Standard Message Identifier SSM.",
    TIME_MODE: "SSIM Chương 4: Time Mode là UTC hoặc LT; nếu không cung cấp thì mặc định UTC.",
    MESSAGE_SEQUENCE_REFERENCE: "SSIM Chương 4: Message Sequence Reference dùng để đánh số và liên kết chuỗi SSM.",
    CREATOR_REFERENCE: "SSIM Chương 4: Creator Reference nếu có phải bắt đầu bằng dấu slash (/).",
    RAW_MESSAGE: "SSIM Chương 4: SSM gồm message header, một hoặc nhiều Action Sub-Message, Supplementary Information tùy chọn và Message End.",
  },
  SSM_ACTION_SUB_MESSAGE: {
    SOURCE_FILE_NAME: "Trường quản lý nguồn trong schema; tài liệu SSIM Chương 4 mô tả cấu trúc SSM nhưng không định nghĩa data element này.",
    MESSAGE_SEQUENCE_REFERENCE: "SSIM Chương 4: Action Sub-Message được liên kết với message bằng Message Sequence Reference.",
    SUB_MESSAGE_SEQUENCE: "SSIM Chương 4: SSM gồm một hoặc nhiều Action Sub-Message; cột này lưu thứ tự sub-message trong schema.",
    ACTION_IDENTIFIER: "SSIM Chương 4: Action Identifier xác định thay đổi được thực hiện trên basic schedule.",
    SECONDARY_ACTION_IDENTIFIERS: "SSIM Chương 4: Secondary Action Identifier có thể bổ nghĩa cho Action Identifier chính.",
    CHANGE_REASONS: "SSIM Chương 4: Change Reason(s) mô tả lý do thay đổi khi format yêu cầu.",
    FLIGHT_DESIGNATOR: "SSIM Chương 4: Flight Information chứa Flight Designator.",
    OPERATIONAL_SUFFIX: "SSIM Chương 4: Operational Suffix là phần tùy chọn của Flight Information.",
    EXISTING_PERIOD_OF_OPERATION: "SSIM Chương 4: Period of Operation hiện hữu gồm From và To Dates.",
    EXISTING_DAYS_OF_OPERATION: "SSIM Chương 4: Existing Day(s) of Operation.",
    EXISTING_FREQUENCY_RATE: "SSIM Chương 4: Existing Frequency Rate nếu có phải bắt đầu bằng dấu slash (/).",
    SCHEDULE_VALIDITY_EFFECTIVE_DATE: "SSIM Chương 4: Schedule Validity Effective Date; năm có thể là tùy chọn.",
    SCHEDULE_VALIDITY_DISCONTINUE_DATE: "SSIM Chương 4: Schedule Validity Discontinue Date; năm có thể là tùy chọn.",
    PERIOD_OF_OPERATION: "SSIM Chương 4: Period of Operation gồm From và To Dates, ngăn cách bằng khoảng trắng.",
    DAYS_OF_OPERATION: "SSIM Chương 4: Days of Operation.",
    FREQUENCY_RATE: "SSIM Chương 4: Frequency Rate nếu có phải bắt đầu bằng dấu slash (/).",
    JOINT_OPERATION_AIRLINE_DESIGNATORS: "SSIM Chương 4: Joint Operation Airline Designators (DEI 1).",
    OPERATING_AIRLINE_DISCLOSURE_CODE_SHARE: "SSIM Chương 4: Operating Airline Disclosure - Code Share (DEI 2).",
    AIRCRAFT_OWNER: "SSIM Chương 4: Aircraft Owner (DEI 3).",
    COCKPIT_CREW_EMPLOYER: "SSIM Chương 4: Cockpit Crew Employer (DEI 4).",
    CABIN_CREW_EMPLOYER: "SSIM Chương 4: Cabin Crew Employer (DEI 5).",
    ONWARD_FLIGHT: "SSIM Chương 4: Onward Flight (DEI 6), áp dụng cho leg cuối nếu được khai báo.",
    OPERATING_AIRLINE_DISCLOSURE_SHARED_OR_WET_LEASE: "SSIM Chương 4: Operating Airline Disclosure - Shared Airline hoặc Wet Lease (DEI 9).",
    SERVICE_TYPE: "SSIM Chương 4: Equipment Information chứa Service Type.",
    AIRCRAFT_TYPE: "SSIM Chương 4: Equipment Information chứa Aircraft Type.",
    EQUIPMENT_INFORMATION: "SSIM Chương 4: Equipment Information gồm Service Type, Aircraft Type và thông tin thiết bị liên quan.",
    PASSENGER_RESERVATIONS_BOOKING_DESIGNATOR: "SSIM Chương 4: Passenger Reservations Booking Designator; nếu không có thì Aircraft Configuration/Version phải được khai báo.",
    PASSENGER_RESERVATIONS_BOOKING_MODIFIER: "SSIM Chương 4: Passenger Reservations Booking Modifier nếu được khai báo phải bắt đầu bằng dấu slash (/).",
    AIRCRAFT_CONFIGURATION_VERSION: "SSIM Chương 4: Aircraft Configuration/Version nếu được khai báo phải bắt đầu bằng dấu chấm (.).",
    FLIGHT_LEG_CHANGE_IDENTIFIER: "SSIM Chương 4: Flight Leg(s) Change Identifier thuộc Flight Information và dùng khi thay đổi leg.",
    DEPARTURE_STATION: "SSIM Chương 4: Leg Information chứa Departure Station.",
    SCHEDULED_TIME_OF_AIRCRAFT_DEPARTURE: "SSIM Chương 4: Leg Information chứa Scheduled Time of Aircraft Departure.",
    DATE_VARIATION_FOR_STD: "SSIM Chương 4: Date Variation for STD thuộc Leg Information.",
    SCHEDULED_TIME_OF_PASSENGER_DEPARTURE: "SSIM Chương 4: Leg Information chứa Scheduled Time of Passenger Departure.",
    ARRIVAL_STATION: "SSIM Chương 4: Leg Information chứa Arrival Station.",
    SCHEDULED_TIME_OF_AIRCRAFT_ARRIVAL: "SSIM Chương 4: Leg Information chứa Scheduled Time of Aircraft Arrival.",
    DATE_VARIATION_FOR_STA: "SSIM Chương 4: Date Variation for STA thuộc Leg Information.",
    SCHEDULED_TIME_OF_PASSENGER_ARRIVAL: "SSIM Chương 4: Leg Information chứa Scheduled Time of Passenger Arrival.",
    SUPPLEMENTARY_INFORMATION: "SSIM Chương 4: Supplementary Information Sub-Message là thành phần tùy chọn của SSM.",
    RAW_ROUTING_INFORMATION: "SSIM Chương 4: Raw Routing Information thuộc phần routing của Action Sub-Message.",
    RAW_SUB_MESSAGE: "SSIM Chương 4: Action Sub-Message chứa Action Information, Flight Information và các data element liên quan.",
  },
  ASM_MESSAGE: {
    SOURCE_FILE_NAME: "Trường quản lý nguồn trong schema; tài liệu SSIM Chương 5 mô tả cấu trúc ASM nhưng không định nghĩa data element này.",
    MESSAGE_ADDRESS_ORIGINATOR: "SSIM Chương 5: Message Address/Originator theo quy định liên lạc.",
    STANDARD_MESSAGE_IDENTIFIER: "SSIM Chương 5: Message Header chứa Ad-Hoc Schedules Message Identifier ASM.",
    TIME_MODE: "SSIM Chương 5: nếu Time Mode không được cung cấp thì mặc định UTC.",
    MESSAGE_SEQUENCE_REFERENCE: "SSIM Chương 5: Message Sequence Reference dùng để đánh số và liên kết chuỗi ASM.",
    CREATOR_REFERENCE: "SSIM Chương 5: Creator Reference nếu có phải bắt đầu bằng dấu slash (/).",
    RAW_MESSAGE: "SSIM Chương 5: ASM gồm message header, một hoặc nhiều Action Sub-Message, Supplementary Information tùy chọn và Message End.",
  },
  ASM_ACTION_SUB_MESSAGE: {
    SOURCE_FILE_NAME: "Trường quản lý nguồn trong schema; tài liệu SSIM Chương 5 mô tả cấu trúc ASM nhưng không định nghĩa data element này.",
    MESSAGE_SEQUENCE_REFERENCE: "SSIM Chương 5: Action Sub-Message được liên kết với message bằng Message Sequence Reference.",
    SUB_MESSAGE_SEQUENCE: "SSIM Chương 5: ASM gồm một hoặc nhiều Action Sub-Message; cột này lưu thứ tự sub-message trong schema.",
    ACTION_IDENTIFIER: "SSIM Chương 5: Action Identifier xác định loại thay đổi của ASM.",
    SECONDARY_ACTION_IDENTIFIERS: "SSIM Chương 5: có thể dùng một hoặc hai Action Identifier theo quy tắc của primary Action Identifier.",
    CHANGE_REASONS: "SSIM Chương 5: Change Reason(s) đi kèm khi Action Identifier yêu cầu.",
    FLIGHT_IDENTIFIER: "SSIM Chương 5: Flight Identifier gồm Airline Designator, Flight Number, Operational Suffix nếu có và Flight Identifier Date.",
    OPERATIONAL_SUFFIX: "SSIM Chương 5: Operational Suffix là phần tùy chọn của Flight Identifier.",
    FLIGHT_LEG_CHANGE_IDENTIFIER: "SSIM Chương 5: Flight Leg Change Identifier xác định leg được thay đổi.",
    PERIOD_OF_OPERATION: "SSIM Chương 5: Period of Operation gồm From và To Dates.",
    DAYS_OF_OPERATION: "SSIM Chương 5: Days of Operation.",
    FREQUENCY_RATE: "SSIM Chương 5: Frequency Rate nếu có phải bắt đầu bằng dấu slash (/).",
    SERVICE_TYPE: "SSIM Chương 5: Equipment Information chứa Service Type.",
    AIRCRAFT_TYPE: "SSIM Chương 5: Equipment Information chứa Aircraft Type.",
    PASSENGER_RESERVATIONS_BOOKING_DESIGNATOR: "SSIM Chương 5: Passenger Reservations Booking Designator; nếu không có thì Aircraft Configuration/Version phải được khai báo.",
    PASSENGER_RESERVATIONS_BOOKING_MODIFIER: "SSIM Chương 5: Passenger Reservations Booking Modifier nếu được khai báo phải bắt đầu bằng dấu slash (/).",
    AIRCRAFT_CONFIGURATION_VERSION: "SSIM Chương 5: Aircraft Configuration/Version nếu được khai báo phải bắt đầu bằng dấu chấm (.).",
    OPERATING_AIRLINE_DISCLOSURE_CODE_SHARE: "SSIM Chương 5: Operating Airline Disclosure - Code Share (DEI 2).",
    AIRCRAFT_OWNER: "SSIM Chương 5: Aircraft Owner (DEI 3).",
    COCKPIT_CREW_EMPLOYER: "SSIM Chương 5: Cockpit Crew Employer (DEI 4).",
    CABIN_CREW_EMPLOYER: "SSIM Chương 5: Cabin Crew Employer (DEI 5).",
    ONWARD_FLIGHT: "SSIM Chương 5: Onward Flight (DEI 6), áp dụng cho leg cuối nếu được khai báo.",
    OPERATING_AIRLINE_DISCLOSURE_SHARED_OR_WET_LEASE: "SSIM Chương 5: Operating Airline Disclosure - Shared Airline hoặc Wet Lease (DEI 9).",
    DEPARTURE_STATION: "SSIM Chương 5: Leg Information chứa Departure Station.",
    SCHEDULED_TIME_OF_AIRCRAFT_DEPARTURE: "SSIM Chương 5: Leg Information chứa Scheduled Time of Aircraft Departure.",
    SCHEDULED_TIME_OF_PASSENGER_DEPARTURE: "SSIM Chương 5: Leg Information chứa Scheduled Time of Passenger Departure.",
    ARRIVAL_STATION: "SSIM Chương 5: Leg Information chứa Arrival Station.",
    SCHEDULED_TIME_OF_AIRCRAFT_ARRIVAL: "SSIM Chương 5: Leg Information chứa Scheduled Time of Aircraft Arrival.",
    SCHEDULED_TIME_OF_PASSENGER_ARRIVAL: "SSIM Chương 5: Leg Information chứa Scheduled Time of Passenger Arrival.",
    RAW_SUB_MESSAGE: "SSIM Chương 5: Action Sub-Message chứa Action Information, Flight Information, Equipment Information và Leg Information.",
  },
};
let artifactTool;

async function loadArtifactTool() {
  if (artifactTool) return artifactTool;
  const customPath = process.env.OAI_ARTIFACT_TOOL_PATH;
  artifactTool = customPath
    ? await import(pathToFileURL(path.join(customPath, "dist/artifact_tool.mjs")).href)
    : await import("@oai/artifact-tool");
  return artifactTool;
}

async function validateTemplateStructure(workbook) {
  const sheetNames = workbook.worksheets.items.map((worksheet) => worksheet.name);
  const sheet = workbook.worksheets.getItem(TEMPLATE_SHEET);
  const headers = sheet.getRange("A5:AD5").values[0].map((value) => String(value ?? ""));
  if (JSON.stringify(sheetNames) !== JSON.stringify(TEMPLATE_SHEETS)
    || JSON.stringify(headers) !== JSON.stringify(CURRENT_COLUMNS)) {
    throw new Error(`Template không khớp contract Bronze 4 sheet A:AD: ${sheetNames.join(" | ")}`);
  }
  return "bronze";
}

function printUsage() {
  console.log(`Usage:
  node scripts/create_survey_workbooks.mjs \
    --template <template.xlsx> \
    --ddl <file.sql> [--ddl <file.sql> ...] \
    --object <SCHEMA.TABLE> [--object <SCHEMA.TABLE> ...] \
    [--description-csv <description.csv>] \
    [--sample-data <sample.csv|sample.json> ...] \
    [--reference <file> ...] \
    [--input-dir <directory>] \
    [--data-source <CODE>] [--db <DB>] [--system <SYSTEM>] \
    [--function-group <GROUP>] [--designer <NAME>] [--overview-file <file>] \
    [--oracle-max-string-size <STANDARD|EXTENDED>] \
    [--oracle-national-character-set <AL16UTF16|UTF8>] \
    [--output-dir <directory>] [--all]

Options:
  --template          Survey 05 template workbook. Default: bundled assets/ template.
  --ddl               DDL file. Repeat for multiple files. Default: bundled sources/ DDLs.
  --object            Exact SCHEMA.TABLE target. Repeat for multiple targets.
  --description-csv   Optional CSV with description/sample columns.
  --sample-data       Optional masked sample data in CSV or JSON format. Repeat for multiple files.
  --reference         Additional reference file that belongs to the input scope. Repeat as needed.
  --input-dir         Directory whose accessible files must be reviewed before analysis.
  --data-source       Bronze source code, uppercase and <= 10 characters.
  --db                Source database name used in the Bronze table name.
  --system            Source system label written to 00-META.
  --function-group    Functional group written to 00-META.
  --designer          Designer name written to 00-META.
  --overview-file     Source overview file path written to 00-META.
  --oracle-max-string-size  Oracle AI Database 26ai MAX_STRING_SIZE context; default EXTENDED.
  --oracle-national-character-set  Oracle AI Database 26ai national character set; default UTF8.
  --output-dir        Output directory. Default: bundled outputs/.
  --all               Create one workbook for every CREATE TABLE in the DDL files.
  --help              Show this help.
`);
}

function parseArgs(argv) {
  const args = {
    ddl: [],
    objects: [],
    sampleData: [],
    referenceFiles: [...DEFAULT_REFERENCE_FILES],
    outputDir: DEFAULT_OUTPUT_DIR,
    template: DEFAULT_TEMPLATE,
    inputDir: "",
    dataSource: "",
    database: "",
    system: "",
    functionGroup: "",
    designer: "",
    overviewFile: "",
    oracleMaxStringSize: "EXTENDED",
    oracleNationalCharacterSet: "UTF8",
    all: false,
  };
  let customDdl = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help") {
      printUsage();
      process.exit(0);
    }
    if (arg === "--all") {
      args.all = true;
      continue;
    }
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      throw new Error(`Thiếu giá trị cho ${arg}`);
    }
    if (arg === "--template") args.template = next;
    else if (arg === "--ddl") {
      if (!customDdl) args.ddl = [];
      customDdl = true;
      args.ddl.push(next);
    }
    else if (arg === "--object") args.objects.push(next);
    else if (arg === "--description-csv") args.descriptionCsv = next;
    else if (arg === "--sample-data") args.sampleData.push(next);
    else if (arg === "--reference") args.referenceFiles.push(next);
    else if (arg === "--input-dir") args.inputDir = next;
    else if (arg === "--data-source") args.dataSource = next;
    else if (arg === "--db") args.database = next;
    else if (arg === "--system") args.system = next;
    else if (arg === "--function-group") args.functionGroup = next;
    else if (arg === "--designer") args.designer = next;
    else if (arg === "--overview-file") args.overviewFile = next;
    else if (arg === "--oracle-max-string-size") args.oracleMaxStringSize = next.toUpperCase();
    else if (arg === "--oracle-national-character-set") args.oracleNationalCharacterSet = next.toUpperCase();
    else if (arg === "--output-dir") args.outputDir = next;
    else throw new Error(`Tham số không hỗ trợ: ${arg}`);
    i += 1;
  }
  if (args.ddl.length === 0) args.ddl = DEFAULT_DDL;
  if (!args.all && args.objects.length === 0) {
    throw new Error("Cần --object hoặc --all để tránh tạo nhầm toàn bộ DDL");
  }
  if (args.all && args.objects.length > 0) {
    throw new Error("Chỉ dùng một trong --object hoặc --all");
  }
  if (!["STANDARD", "EXTENDED"].includes(args.oracleMaxStringSize)) {
    throw new Error("--oracle-max-string-size chỉ nhận STANDARD hoặc EXTENDED");
  }
  if (!["AL16UTF16", "UTF8"].includes(args.oracleNationalCharacterSet)) {
    throw new Error("--oracle-national-character-set chỉ nhận AL16UTF16 hoặc UTF8");
  }
  return args;
}

function isPathInside(childPath, parentPath) {
  const relative = path.relative(path.resolve(parentPath), path.resolve(childPath));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function listInputFiles(inputDir, outputDir) {
  const files = [];
  const errors = [];
  async function visit(currentDir) {
    let entries;
    try {
      entries = (await fs.readdir(currentDir, { withFileTypes: true }))
        .sort((left, right) => left.name.localeCompare(right.name));
    } catch (error) {
      errors.push({
        filePath: currentDir,
        status: "UNREADABLE",
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }
    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if ([".git", "node_modules"].includes(entry.name) || isPathInside(entryPath, outputDir)) continue;
        await visit(entryPath);
      } else if (entry.isFile() && !isPathInside(entryPath, outputDir)) {
        files.push(entryPath);
      }
    }
  }
  await visit(inputDir);
  return { files, errors };
}

async function reviewInputFiles(args) {
  const explicitFiles = [
    args.template,
    ...args.ddl,
    ...(args.descriptionCsv ? [args.descriptionCsv] : []),
    ...args.sampleData,
    ...args.referenceFiles,
  ];
  const directoryReview = args.inputDir
    ? await listInputFiles(args.inputDir, args.outputDir)
    : { files: [], errors: [] };
  const directoryFiles = directoryReview.files;
  const files = [...new Set([...explicitFiles, ...directoryFiles].map((filePath) => path.resolve(filePath)))];
  const statuses = [...directoryReview.errors];

  // Đọc tuần tự từng file để không phân tích file sau khi file trước còn chưa được review.
  for (const filePath of files) {
    try {
      const content = await fs.readFile(filePath);
      statuses.push({ filePath, status: "READ_SUCCESS", bytes: content.byteLength });
    } catch (error) {
      statuses.push({
        filePath,
        status: "UNREADABLE",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const unreadable = statuses.filter((item) => item.status === "UNREADABLE");
  return {
    total: statuses.length,
    processed: statuses.length,
    successfullyRead: statuses.length - unreadable.length,
    unreadable,
    statuses,
    allReviewed: unreadable.length === 0,
  };
}

async function writeFileReviewCheckpoint(outputDir, review) {
  const lines = [
    "FILE REVIEW CHECKPOINT",
    "",
    `Total input files: ${review.total}`,
    `Files processed: ${review.processed}`,
    `Successfully read: ${review.successfullyRead}`,
    `Unreadable files: ${review.unreadable.length}`,
    "Skipped files: 0",
    "",
    `All accessible files have been reviewed: ${review.allReviewed ? "YES" : "NO"}`,
    "",
    "Files:",
    ...review.statuses.map((item) => {
      const suffix = item.status === "UNREADABLE" ? ` | ${item.error}` : ` | ${item.bytes} bytes`;
      return `- ${item.status}: ${item.filePath}${suffix}`;
    }),
  ];
  const checkpointPath = path.join(outputDir, "file-review-checkpoint.txt");
  await fs.writeFile(checkpointPath, `${lines.join("\n")}\n`, "utf8");
  return checkpointPath;
}

function normalizeIdentifier(value) {
  return value.trim().replace(/^"|"$/g, "").trim().toUpperCase();
}

// Cột Bronze phải tránh keyword Oracle để DDL đích không bị mơ hồ khi dựng bảng.
const ORACLE_RESERVED_WORDS = new Set([
  "ACCESS", "ADD", "ALL", "ALTER", "AND", "ANY", "AS", "ASC", "AUDIT", "BETWEEN", "BY", "CHAR",
  "CHECK", "CLUSTER", "COLUMN", "COMMENT", "COMPRESS", "CONNECT", "CREATE", "CURRENT", "DATE",
  "DECIMAL", "DEFAULT", "DELETE", "DESC", "DISTINCT", "DROP", "ELSE", "EXCLUSIVE", "EXISTS", "FILE",
  "FLOAT", "FOR", "FROM", "GRANT", "GROUP", "HAVING", "IDENTIFIED", "IMMEDIATE", "IN", "INDEX",
  "INITIAL", "INSERT", "INTEGER", "INTERSECT", "INTO", "IS", "LEVEL", "LIKE", "LOCK", "LONG",
  "MAXEXTENTS", "MINUS", "MLSLABEL", "MODE", "MODIFY", "NOAUDIT", "NOCOMPRESS", "NOT", "NOWAIT",
  "NULL", "NUMBER", "OF", "OFFLINE", "ON", "ONLINE", "OPTION", "OR", "ORDER", "PCTFREE", "PRIOR",
  "PRIVILEGES", "PUBLIC", "RAW", "RENAME", "RESOURCE", "REVOKE", "ROW", "ROWID", "ROWNUM", "ROWS",
  "SELECT", "SESSION", "SET", "SHARE", "SIZE", "SMALLINT", "START", "SUCCESSFUL", "SYNONYM", "SYSDATE",
  "TABLE", "THEN", "TO", "TRIGGER", "UNION", "UNIQUE", "UPDATE", "USER", "VALIDATE", "VALUES", "VARCHAR",
  "VARCHAR2", "VIEW", "WHENEVER", "WHERE", "WITH",
]);

function bronzeColumnName(columnName) {
  // Chỉ đổi tên ở lớp Bronze; tên cột nguồn trong cột B vẫn giữ nguyên để đối chiếu DDL.
  const normalized = normalizeIdentifier(columnName);
  return ORACLE_RESERVED_WORDS.has(normalized) || normalized.startsWith("BRONZE_") ? `${normalized}_` : normalized;
}

function bronzeTableName(table, args) {
  const parts = [args.dataSource || "UNKNOWN_SOURCE", args.database || "UNKNOWN_DB", table.schema || "UNKNOWN_SCHEMA", table.name]
    .map((value) => safeFilePart(normalizeIdentifier(value)).replace(/[^A-Z0-9_$#-]/g, "_") || "UNKNOWN");
  return parts.join("_").toUpperCase();
}

function objectKey(schema, name) {
  return `${normalizeIdentifier(schema)}.${normalizeIdentifier(name)}`;
}

function unquoteIdentifier(value) {
  return value.replace(/^"|"$/g, "").trim();
}

function findMatchingParen(text, openingIndex) {
  let depth = 0;
  let quote = null;
  for (let i = openingIndex; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (quote) {
      if (char === quote && next === quote) {
        i += 1;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === "(") depth += 1;
    if (char === ")") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function splitTopLevel(text) {
  const items = [];
  let start = 0;
  let depth = 0;
  let quote = null;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (quote) {
      if (char === quote && next === quote) {
        i += 1;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === "(") depth += 1;
    else if (char === ")") depth -= 1;
    else if (char === "," && depth === 0) {
      items.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  const tail = text.slice(start).trim();
  if (tail) items.push(tail);

  // Tách theo cấp ngoặc để dấu phẩy trong NUMBER(12,3) hoặc CHECK không tạo field giả.
  return items;
}

function parseColumnReferenceList(value) {
  return value
    .split(",")
    .map((item) => normalizeIdentifier(item))
    .filter(Boolean);
}

function parseCreateTables(sql, sourceFile) {
  const results = [];
  const header = /CREATE\s+TABLE\s+((?:"[^"]+"|[A-Za-z0-9_$#]+)(?:\s*\.\s*(?:"[^"]+"|[A-Za-z0-9_$#]+))?)\s*\(/gi;
  let match;
  while ((match = header.exec(sql)) !== null) {
    const qualifiedName = match[1].replace(/\s+/g, "");
    const nameParts = qualifiedName.split(".");
    const rawSchema = nameParts.length === 2 ? nameParts[0] : "";
    const rawName = nameParts.length === 2 ? nameParts[1] : nameParts[0];
    const openingIndex = header.lastIndex - 1;
    const closingIndex = findMatchingParen(sql, openingIndex);
    if (closingIndex < 0) throw new Error(`Không tìm thấy dấu đóng của ${qualifiedName} trong ${sourceFile}`);

    const body = sql.slice(openingIndex + 1, closingIndex);
    const table = {
      schema: unquoteIdentifier(rawSchema),
      name: unquoteIdentifier(rawName),
      objectType: "table",
      sourceFile,
      columns: [],
      primaryKeys: new Set(),
      uniqueConstraints: [],
      foreignKeys: new Map(),
      notNull: new Set(),
    };

    for (const item of splitTopLevel(body)) {
      const constraint = item.match(/^CONSTRAINT\s+(?:"[^"]+"|[A-Za-z0-9_$#]+)\s+([\s\S]+)$/i);
      if (constraint) {
        const definition = constraint[1];
        const primary = definition.match(/^PRIMARY\s+KEY\s*\(([^)]+)\)/i);
        if (primary) {
          for (const column of parseColumnReferenceList(primary[1])) table.primaryKeys.add(column);
          continue;
        }
        const unique = definition.match(/^UNIQUE\s*\(([^)]+)\)/i);
        if (unique) {
          table.uniqueConstraints.push(parseColumnReferenceList(unique[1]));
          continue;
        }
        const foreign = definition.match(/^FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+((?:"[^"]+"|[A-Za-z0-9_$#]+)(?:\s*\.\s*(?:"[^"]+"|[A-Za-z0-9_$#]+))?)\s*\(([^)]+)\)/i);
        if (foreign) {
          const referenceParts = foreign[2].replace(/\s+/g, "").split(".");
          const rawRefSchema = referenceParts.length === 2 ? referenceParts[0] : "";
          const rawRefTable = referenceParts.length === 2 ? referenceParts[1] : referenceParts[0];
          const localColumns = parseColumnReferenceList(foreign[1]);
          const refColumns = parseColumnReferenceList(foreign[3]);
          localColumns.forEach((column, index) => {
            const refColumn = refColumns[index] ?? refColumns[0] ?? "";
            const schemaPrefix = rawRefSchema ? `${unquoteIdentifier(rawRefSchema)}.` : "";
            table.foreignKeys.set(column, `${schemaPrefix}${unquoteIdentifier(rawRefTable)}.${refColumn}`);
          });
          continue;
        }
        const notNull = definition.match(/^CHECK\s*\(\s*"?([A-Za-z0-9_$#]+)"?\s+IS\s+NOT\s+NULL\s*\)$/i);
        if (notNull) table.notNull.add(normalizeIdentifier(notNull[1]));
        continue;
      }

      // Oracle đặt supplemental logging và CHECK không tên trong cùng danh sách với cột;
      // đây là metadata/constraint của bảng nên không được biến thành field trong survey.
      if (/^(?:SUPPLEMENTAL\s+LOG|CHECK\s*\()/i.test(item)) continue;

      const columnMatch = item.match(/^("[^"]+"|[A-Za-z0-9_$#]+)\s+([\s\S]+)$/);
      if (!columnMatch) continue;
      const name = unquoteIdentifier(columnMatch[1]);
      let definition = columnMatch[2].trim();
      let defaultValue = "";
      const defaultMatch = definition.match(/\s+DEFAULT\s+([\s\S]+?)(?=\s+(?:NOT\s+NULL|NULL)(?:\s+(?:ENABLE|DISABLE))?\s*$|$)/i);
      if (defaultMatch) {
        defaultValue = defaultMatch[1].trim();
        definition = definition.slice(0, defaultMatch.index).trim();
      }
      const explicitNotNull = /\bNOT\s+NULL\b/i.test(definition);
      definition = definition.replace(/\s+(?:NOT\s+NULL|NULL)(?:\s+(?:ENABLE|DISABLE))?\s*$/i, "").trim();
      table.columns.push({ name, type: definition, defaultValue, explicitNotNull });
      if (explicitNotNull) table.notNull.add(normalizeIdentifier(name));
    }

    for (const column of table.columns) {
      const normalized = normalizeIdentifier(column.name);
      column.isPrimaryKey = table.primaryKeys.has(normalized);
      column.foreignKey = table.foreignKeys.get(normalized) ?? "";
      column.allowNull = column.isPrimaryKey || table.notNull.has(normalized) ? "N" : "";
      column.isUnique = table.uniqueConstraints.some((columns) => columns.length === 1 && columns[0] === normalized);
    }
    results.push(table);
    header.lastIndex = closingIndex + 1;
  }
  return results;
}

function parseCreateViews(sql, sourceFile) {
  const results = [];
  const header = /CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+((?:"[^"]+"|[A-Za-z0-9_$#]+)(?:\s*\.\s*(?:"[^"]+"|[A-Za-z0-9_$#]+))?)\s*(?:\(([^)]*)\))?\s+AS\b/gi;
  let match;
  while ((match = header.exec(sql)) !== null) {
    const qualifiedName = match[1].replace(/\s+/g, "");
    const nameParts = qualifiedName.split(".");
    const rawSchema = nameParts.length === 2 ? nameParts[0] : "";
    const rawName = nameParts.length === 2 ? nameParts[1] : nameParts[0];
    // View không có danh sách cột tường minh thì DDL SELECT không đủ metadata kiểu để tạo dictionary an toàn.
    const columnNames = match[2] ? parseColumnReferenceList(match[2]) : [];
    results.push({
      schema: unquoteIdentifier(rawSchema),
      name: unquoteIdentifier(rawName),
      objectType: "view",
      sourceFile,
      columns: columnNames.map((name) => ({ name, type: "Chưa rõ", defaultValue: "", allowNull: "Chưa rõ", isPrimaryKey: false, isUnique: false, foreignKey: "" })),
      primaryKeys: new Set(),
      uniqueConstraints: [],
      foreignKeys: new Map(),
      notNull: new Set(),
      parseError: columnNames.length === 0 ? "CREATE VIEW không có danh sách cột tường minh; cần data dictionary để xác định cột và kiểu" : "",
    });
  }
  return results;
}

function formatOracle26SizedType(base, size, unit = "") {
  return `${base}(${size}${unit ? ` ${unit}` : ""})`;
}

function oracle26StringLimit(base, context) {
  if (base === "CHAR") return 2000;
  if (base === "VARCHAR2") return context.oracleMaxStringSize === "EXTENDED" ? 32767 : 4000;
  if (base === "NCHAR") return context.oracleNationalCharacterSet === "UTF8" ? 2000 : 1000;
  if (base === "NVARCHAR2") {
    if (context.oracleMaxStringSize === "EXTENDED") {
      return context.oracleNationalCharacterSet === "UTF8" ? 32767 : 16383;
    }
    return context.oracleNationalCharacterSet === "UTF8" ? 4000 : 2000;
  }
  return null;
}

function canonicalizeOracle26Alias(type) {
  const normalized = type.replace(/\s+/g, " ").trim().toUpperCase();
  const aliases = [
    [/^CHARACTER\s*\(\s*(\d+)\s*\)$/, (_, size) => `CHAR(${size})`],
    [/^VARCHAR\s*\(\s*(\d+)\s*\)$/, (_, size) => `VARCHAR2(${size})`],
    [/^CHARACTER\s+VARYING\s*\(\s*(\d+)\s*\)$/, (_, size) => `VARCHAR2(${size})`],
    [/^CHAR\s+VARYING\s*\(\s*(\d+)\s*\)$/, (_, size) => `VARCHAR2(${size})`],
    [/^NATIONAL\s+CHARACTER\s*\(\s*(\d+)\s*\)$/, (_, size) => `NCHAR(${size})`],
    [/^NATIONAL\s+CHAR\s*\(\s*(\d+)\s*\)$/, (_, size) => `NCHAR(${size})`],
    [/^NATIONAL\s+CHARACTER\s+VARYING\s*\(\s*(\d+)\s*\)$/, (_, size) => `NVARCHAR2(${size})`],
    [/^NATIONAL\s+CHAR\s+VARYING\s*\(\s*(\d+)\s*\)$/, (_, size) => `NVARCHAR2(${size})`],
    [/^NCHAR\s+VARYING\s*\(\s*(\d+)\s*\)$/, (_, size) => `NVARCHAR2(${size})`],
    [/^NUMERIC(?:\s*\((\d+)(?:\s*,\s*(-?\d+))?\))?$/, (_, precision, scale) => precision ? `NUMBER(${precision}${scale === undefined ? "" : `,${scale}`})` : "NUMBER"],
    [/^DECIMAL(?:\s*\((\d+)(?:\s*,\s*(-?\d+))?\))?$/, (_, precision, scale) => precision ? `NUMBER(${precision}${scale === undefined ? "" : `,${scale}`})` : "NUMBER"],
    [/^(?:INTEGER|INT|SMALLINT)$/, () => "NUMBER(38)"],
    [/^DOUBLE\s+PRECISION$/, () => "FLOAT(126)"],
    [/^REAL$/, () => "FLOAT(63)"],
  ];
  for (const [pattern, replacement] of aliases) {
    const match = normalized.match(pattern);
    if (match) return replacement(...match);
  }
  return normalized;
}

function normalizeBronzeDatatype(sourceType, context) {
  const original = sourceType.trim();
  const canonical = canonicalizeOracle26Alias(original);
  const textMatch = canonical.match(/^(CHAR|VARCHAR2|NCHAR|NVARCHAR2)\s*(?:\(\s*(\d+)(?:\s+(BYTE|CHAR))?\s*\))?$/i);
  if (textMatch) {
    const base = textMatch[1].toUpperCase();
    const originalSize = textMatch[2] ? Number(textMatch[2]) : base === "CHAR" || base === "NCHAR" ? 1 : null;
    if (originalSize === null) {
      return { status: "conflict", reason: `${base} không có length hữu hạn trong DDL`, question: `Xác nhận length nguyên bản của ${base}: ${original}` };
    }
    const newSize = Math.ceil(originalSize * 1.2);
    const bronzeBase = base === "CHAR" || base === "VARCHAR2" ? "VARCHAR2" : base;
    const maxSize = oracle26StringLimit(bronzeBase, context) ?? 32767;
    if (newSize > maxSize) {
      // Bronze giữ bản sao dữ liệu nên overflow chuỗi phải chuyển sang CLOB, không cắt ngầm length nguồn.
      return {
        status: "ok",
        type: "CLOB",
        note: `Kiểu nguồn ${original}; CEIL(${originalSize} × 1.2) = ${newSize} vượt trần ${maxSize}; kiểu Bronze = CLOB`,
        warning: `${original}: overflow length đã quy đổi thành CLOB theo 04-bronze.md`,
      };
    }
    const outputType = `${bronzeBase}(${newSize} CHAR)`;
    return {
      status: "ok",
      type: outputType,
      note: `Kiểu nguồn ${original}; kiểu Bronze ${outputType}; áp dụng CEIL(${originalSize} × 1.2) đúng một lần`,
    };
  }

  const rawMatch = canonical.match(/^RAW\s*\(\s*(\d+)\s*\)$/i);
  if (rawMatch) {
    const originalSize = Number(rawMatch[1]);
    const newSize = Math.ceil(originalSize * 1.2);
    const maxSize = context.oracleMaxStringSize === "EXTENDED" ? 32767 : 2000;
    if (newSize > maxSize) return { status: "ok", type: "BLOB", note: `RAW(${originalSize}) tăng thành ${newSize}, vượt trần RAW ${maxSize}; kiểu Bronze = BLOB` };
    return { status: "ok", type: `RAW(${newSize})`, note: `Kiểu nguồn ${original}; áp dụng CEIL(${originalSize} × 1.2) đúng một lần` };
  }

  if (/^(?:LONG|LONG\s+RAW)$/i.test(canonical)) return { status: "ok", type: "CLOB", note: `Kiểu nguồn ${original}; kiểu Bronze = CLOB theo 04-bronze.md` };
  if (/^RAW$/i.test(canonical)) return { status: "ok", type: "BLOB", note: `RAW không có length hữu hạn; kiểu Bronze = BLOB` };

  const supported = [
    /^(?:NUMBER(?:\s*\(\s*\d+(?:\s*,\s*-?\d+)?\s*\))?|DATE|BINARY_FLOAT|BINARY_DOUBLE|CLOB|NCLOB|BLOB|BFILE|ROWID|UROWID(?:\s*\(\s*\d+\s*\))?|BOOLEAN|JSON(?:\s*\([\s\S]+\))?|VECTOR(?:\s*\([\s\S]+\))?)$/i,
    /^FLOAT(?:\s*\(\s*\d+\s*\))?$/i,
    /^TIMESTAMP(?:\s*\(\s*\d+\s*\))?(?:\s+WITH(?:\s+LOCAL)?\s+TIME\s+ZONE)?$/i,
    /^INTERVAL\s+YEAR(?:\s*\(\s*\d+\s*\))?\s+TO\s+MONTH$/i,
    /^INTERVAL\s+DAY(?:\s*\(\s*\d+\s*\))?\s+TO\s+SECOND(?:\s*\(\s*\d+\s*\))?$/i,
    /^(?:SYS\.)?(?:XMLTYPE|SDO_GEOMETRY|SDO_TOPO_GEOMETRY|SDO_GEORASTER)$/i,
  ];
  if (supported.some((pattern) => pattern.test(canonical))) {
    return { status: "ok", type: canonical, note: canonical !== original ? `Kiểu nguồn ${original}; kiểu Bronze ${canonical}` : "" };
  }
  return {
    status: "conflict",
    type: original,
    reason: `Không xác minh được quy đổi kiểu Bronze cho ${original}`,
    question: `Cung cấp mapping Oracle AI Database 26ai có bằng chứng cho kiểu ${original}; không tự tạo kiểu thay thế`,
  };
}

function prepareOracle26Datatypes(table, context) {
  const conflicts = [];
  for (const column of table.columns) {
    const result = normalizeBronzeDatatype(column.type, context);
    if (result.status === "conflict") {
      column.oracle26Type = result.type ?? column.type;
      column.oracle26TypeNote = [result.note, result.reason, result.question].filter(Boolean).join(". ");
      conflicts.push(`${column.name}: ${result.reason}. ${result.question}`);
      continue;
    }
    column.oracle26Type = result.type;
    column.oracle26TypeNote = result.note;
    if (result.warning) conflicts.push(`${column.name}: ${result.warning}`);
  }
  return conflicts;
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return [];
  const headers = parseCsvLine(lines[0]).map((header) => header.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

function sampleScope(row) {
  const schema = firstValue(row, ["schema", "table_schema"]);
  const table = firstValue(row, ["table", "table_name", "object_name"]);
  return table ? objectKey(schema, table) : "";
}

function sampleFieldName(row) {
  return firstValue(row, ["column", "column_name", "field", "field_name"]);
}

function removeSampleMetadata(row) {
  const metadataNames = new Set([
    "schema",
    "table",
    "table_schema",
    "table_name",
    "object_name",
    "column",
    "column_name",
    "field",
    "field_name",
  ]);
  return Object.fromEntries(
    Object.entries(row).filter(([key]) => !metadataNames.has(key.toLowerCase())),
  );
}

function normalizeSampleJson(value) {
  if (Array.isArray(value)) {
    const tableRecordGroups = value.filter((entry) =>
      entry && typeof entry === "object" && entry.table_name
      && entry.source && Array.isArray(entry.source.records),
    );
    if (tableRecordGroups.length === value.length && tableRecordGroups.length > 0) {
      // Nguồn Scheduled-Management nhóm bản ghi theo table_name nên cần ánh xạ từng nhóm về đúng bảng DDL.
      return tableRecordGroups.map((entry) => ({
        scope: objectKey("", entry.table_name),
        rows: entry.source.records,
      }));
    }
    const scopedRecords = value.filter((entry) =>
      entry && typeof entry === "object" && entry.data && typeof entry.data === "object"
      && sampleScope(entry),
    );
    if (scopedRecords.length === value.length && scopedRecords.length > 0) {
      // data.json lưu một mẫu theo từng bảng nên cần giữ metadata để không gán nhầm mẫu giữa các bảng.
      return scopedRecords.map((entry) => ({
        scope: sampleScope(entry),
        rows: [entry.data],
      }));
    }
    return [{ scope: "", rows: value }];
  }
  if (!value || typeof value !== "object") return [];

  const rowCollection = Array.isArray(value.rows) ? value.rows : Array.isArray(value.data) ? value.data : null;
  if (rowCollection) {
    const scope = sampleScope(value);
    return [{ scope, rows: rowCollection }];
  }

  const groupedRows = Object.entries(value).filter(([, rows]) => Array.isArray(rows));
  if (groupedRows.length > 0) {
    return groupedRows.map(([scope, rows]) => ({ scope: scope.includes(".") ? objectKey(...scope.split(".")) : "", rows }));
  }

  return [{ scope: sampleScope(value), rows: [value] }];
}

async function loadSampleData(samplePaths) {
  const grouped = new Map();
  for (const samplePath of samplePaths) {
    const text = await fs.readFile(samplePath, "utf8");
    const extension = path.extname(samplePath).toLowerCase();
    const parsed = extension === ".json"
      ? normalizeSampleJson(JSON.parse(text))
      : parseCsv(text).reduce((groups, row) => {
          const scope = sampleScope(row);
          const rows = groups.get(scope) ?? [];
          rows.push(removeSampleMetadata(row));
          groups.set(scope, rows);
          return groups;
        }, new Map());
    const entries = parsed instanceof Map ? [...parsed.entries()].map(([scope, rows]) => ({ scope, rows })) : parsed;
    for (const entry of entries) {
      const rows = grouped.get(entry.scope) ?? [];
      grouped.set(entry.scope, rows.concat(entry.rows));
    }
  }
  return grouped;
}

function sampleRowsForTable(sampleData, table, targetCount) {
  const scoped = sampleData.get(objectKey(table.schema, table.name));
  if (scoped) return scoped;
  const unscoped = sampleData.get("");
  return targetCount === 1 ? unscoped ?? [] : [];
}

function sampleValueForColumn(row, columnName) {
  const normalizedColumn = normalizeIdentifier(columnName);
  const entry = Object.entries(row).find(([key]) => normalizeIdentifier(key) === normalizedColumn);
  return entry ? entry[1] : undefined;
}

function sampleText(value) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  // XML của XLSX không cho phép ký tự điều khiển nên phải loại khỏi mẫu trước khi xuất workbook.
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();
}

function sampleValuesForColumn(columnName, sampleRows) {
  const values = sampleRows
    .map((row) => sampleText(sampleValueForColumn(row, columnName)))
    .filter(Boolean);
  return [...new Set(values)];
}

function firstValue(row, names) {
  for (const name of names) {
    const value = row[name.toLowerCase()];
    if (value !== undefined && value.trim() !== "") return value.trim();
  }
  return "";
}

function findDescription(row, table) {
  const rowSchema = firstValue(row, ["schema", "table_schema"]);
  const rowTable = firstValue(row, ["table", "table_name", "object_name"]);
  const rowColumn = firstValue(row, ["column", "column_name", "field", "field_name"]);
  if (rowSchema && normalizeIdentifier(rowSchema) !== normalizeIdentifier(table.schema)) return false;
  if (rowTable && normalizeIdentifier(rowTable) !== normalizeIdentifier(table.name)) return false;
  return Boolean(rowColumn);
}

function csvValue(rows, table, columnName, fieldNames) {
  const row = rows.find((candidate) => findDescription(candidate, table) && normalizeIdentifier(firstValue(candidate, ["column", "column_name", "field", "field_name"])) === normalizeIdentifier(columnName));
  return row ? firstValue(row, fieldNames) : "";
}

// Bảng Markdown cần escape dấu | và chuyển xuống dòng thành <br> để mỗi báo cáo vẫn giữ đúng cấu trúc cột.
function markdownEscape(value) {
  return String(value ?? "")
    .replaceAll("|", "\\|")
    .replaceAll(/\r?\n/g, "<br>");
}

function markdownReport(rows) {
  const [headers, ...body] = rows;
  const headerLine = `| ${headers.map(markdownEscape).join(" | ")} |`;
  const separatorLine = `| ${headers.map(() => "---").join(" | ")} |`;
  const bodyLines = body.map((row) => `| ${row.map(markdownEscape).join(" | ")} |`);
  return [headerLine, separatorLine, ...bodyLines].join("\n") + "\n";
}

function safeFilePart(value) {
  return value.replace(/[^A-Za-z0-9._-]+/g, "_");
}

function documentDescriptionForColumn(table, columnName) {
  const tableDescriptions = DOCUMENT_DESCRIPTIONS[normalizeIdentifier(table.name)] ?? {};
  return tableDescriptions[normalizeIdentifier(columnName)] ?? "";
}

const AIR_WAYBILL_DESCRIPTIONS = {
  AIR_WAYBILL_PREFIX: "Mã tiền tố hãng hàng không của vận đơn hàng không (AWB), thường là phần 3 chữ số đầu của số AWB.",
  AIR_WAYBILL_NUMBER: "Số vận đơn hàng không dùng để định danh lô hàng trong quá trình vận chuyển hàng hóa bằng đường hàng không.",
  AWB_TYPE: "Loại vận đơn hàng không áp dụng cho lô hàng.",
  CONDITION_OF_PAYMENT: "Điều kiện thanh toán áp dụng cho các khoản phí trên vận đơn.",
  PAYMENT_CODE: "Mã phương thức thanh toán của vận đơn.",
  DATE_OF_ISSUE: "Ngày phát hành vận đơn hàng không.",
  CURRENCY_OF_ISSUE: "Mã tiền tệ được sử dụng khi phát hành và tính các khoản phí trên vận đơn.",
  ACCOUNTING_CODE: "Mã kế toán dùng để hạch toán giao dịch của vận đơn.",
  ACCOUNTING_TEXT: "Nội dung kế toán đi kèm giao dịch của vận đơn.",
  AGENT_BRANCH_OFFICE: "Mã chi nhánh đại lý xử lý vận đơn.",
  AGENT_NUMBER: "Mã hoặc số định danh của đại lý.",
  SHIPPER: "Mã hoặc định danh của người gửi hàng.",
  SHIPPER_NAME: "Tên người hoặc tổ chức gửi hàng.",
  CONSIGNEE: "Mã hoặc định danh của người nhận hàng.",
  CONSIGNEE_NAME: "Tên người hoặc tổ chức nhận hàng.",
  CITY_CODE_ORIGIN: "Mã thành phố hoặc sân bay xuất phát của lô hàng.",
  CITY_CODE_DESTINATION: "Mã thành phố hoặc sân bay đích của lô hàng.",
  ROUTING: "Chuỗi điểm hoặc chặng vận chuyển của lô hàng.",
  TOTAL_PIECES: "Tổng số kiện hàng ghi nhận trên vận đơn.",
  ACTUAL_WEIGHT: "Khối lượng thực tế của lô hàng.",
  VOLUME_WEIGHT: "Khối lượng quy đổi theo thể tích của lô hàng.",
  CHARGEABLE_WEIGHT: "Khối lượng tính cước, được sử dụng làm cơ sở tính phí vận chuyển.",
  WEIGHT_UNIT: "Đơn vị đo khối lượng áp dụng cho các giá trị trọng lượng của lô hàng.",
  NET_RATE: "Đơn giá cước thuần áp dụng để tính chi phí vận chuyển của lô hàng.",
  WEIGHT_CHARGES: "Khoản cước vận chuyển được tính dựa trên khối lượng tính cước.",
  NATURE_OF_GOODS: "Mô tả tính chất hoặc loại hàng hóa được vận chuyển.",
  AWB_NUMBER: "Số vận đơn hàng không dùng để định danh lô hàng trong quá trình vận chuyển hàng hóa bằng đường hàng không.",
  AIRLINE_PREFIX: "Mã tiền tố hãng hàng không của vận đơn hàng không (AWB), thường là phần 3 chữ số đầu của số AWB.",
  SERIAL_NUMBER: "Phần số serial của vận đơn, dùng cùng tiền tố hãng hàng không để tạo số AWB.",
  DUPLICATE_SUFFIX: "Ký hiệu phân biệt vận đơn trùng số khi cùng tiền tố và số serial.",
  GENERATION_DATE: "Ngày hệ thống tạo bản ghi vận đơn.",
  CUT_DATE: "Ngày cắt dữ liệu hoặc chốt xử lý của vận đơn.",
  CREATE_DATE: "Thời điểm tạo bản ghi vận đơn trong hệ thống.",
  CREATION_TYPE_IND: "Loại nguồn hoặc phương thức tạo vận đơn.",
  FIRST_FLOWN_DATE: "Ngày vận đơn được ghi nhận bay lần đầu.",
  AWB_LIFE_CYCLE_STA: "Trạng thái hiện tại trong vòng đời xử lý của vận đơn.",
  AWB_BILLING_TYPE: "Loại nghiệp vụ tính cước hoặc lập hóa đơn của vận đơn.",
  AWB_ORIGIN_CITY: "Mã thành phố hoặc sân bay xuất phát của lô hàng.",
  AWB_DEST_CITY: "Mã thành phố hoặc sân bay đích của lô hàng.",
  VATABLE_SHPMNT_IND: "Cờ cho biết lô hàng có thuộc diện tính VAT hay không.",
  AGENTS_REFERENCE: "Mã tham chiếu của đại lý liên quan đến vận đơn.",
  HNDL_DESCRIPTION: "Mô tả yêu cầu hoặc hướng dẫn xử lý đặc biệt của lô hàng.",
  PART_SHIPMENT_IND: "Cờ cho biết vận đơn có thuộc một lô hàng giao từng phần hay không.",
  SERVICE_SHIP_IND: "Cờ cho biết vận đơn có sử dụng dịch vụ vận chuyển hay không.",
  PART_RATE_IND: "Cờ cho biết vận đơn có áp dụng biểu cước từng phần hay không.",
  REMARKS: "Ghi chú bổ sung liên quan đến vận đơn.",
  ORG_CR_CARD_AMT: "Số tiền thanh toán bằng thẻ tín dụng tại nơi gửi.",
  ORGN_CR_CARD_NUM: "Số thẻ tín dụng được sử dụng tại nơi gửi.",
  ORGN_CR_CARD_PREF: "Mã nhận diện loại thẻ tín dụng tại nơi gửi.",
  GBL_NUMBER: "Số tham chiếu vận đơn toàn cầu của lô hàng.",
  ORIGIN_CURRENCY: "Mã tiền tệ áp dụng tại nơi gửi.",
  CUSTOMS_VALUE: "Trị giá hải quan khai báo của lô hàng.",
  CARRIAGE_VALUE: "Trị giá vận chuyển khai báo của lô hàng.",
  INSURANCE_VALUE: "Trị giá bảo hiểm khai báo của lô hàng.",
  VAT_AMOUNT_DUE: "Số tiền VAT phải nộp cho vận đơn.",
  TOT_NBR_OF_PIECES: "Tổng số kiện hàng ghi nhận trên vận đơn.",
  WEIGHT_UNIT_IND: "Mã đơn vị đo khối lượng áp dụng cho vận đơn.",
  TOTAL_GROSS_WEIGHT: "Tổng khối lượng cả bì của lô hàng.",
  TOTAL_CHGES_AMT: "Tổng số tiền các khoản cước và phí của vận đơn.",
  CC_CONVERS_RATE: "Tỷ giá quy đổi khoản thu sau sang tiền tệ đích.",
  MATCH_STATUS: "Trạng thái đối soát hoặc khớp dữ liệu của vận đơn.",
  RATE_AUDIT_REASON: "Mã lý do kiểm tra hoặc điều chỉnh biểu cước.",
  RATE_AUDIT_TOTAL: "Tổng số tiền được xác định trong quá trình kiểm tra biểu cước.",
  UPDATE_DATE: "Ngày cập nhật gần nhất của bản ghi vận đơn.",
  UPDATE_TIME: "Thời điểm cập nhật gần nhất của bản ghi vận đơn.",
  USER_ID: "Mã người dùng thực hiện thao tác gần nhất trên bản ghi.",
  PRODUCT_CODE: "Mã sản phẩm hoặc dịch vụ áp dụng cho vận đơn.",
  DELIVERY_DATE: "Ngày dự kiến hoặc thực tế giao hàng của lô hàng.",
  BILL_TO_PARTY: "Mã bên chịu trách nhiệm thanh toán cước hoặc phí của vận đơn.",
  ISSUE_PORT: "Mã cảng hoặc điểm phát hành vận đơn.",
  NO_OF_HOUSE_AWB: "Số lượng house AWB thuộc vận đơn hoặc lô hàng này.",
  CCA_NUMBER: "Số chứng từ CCA liên quan đến vận đơn.",
  CCA_ISSUING_AIRLINE: "Mã hãng hàng không phát hành chứng từ CCA.",
  CCA_ISSUING_DATE: "Ngày phát hành chứng từ CCA.",
  CCA_PLACE_OF_ISSUE: "Địa điểm phát hành chứng từ CCA.",
  CCA_SIGNATURE: "Chữ ký trên chứng từ CCA.",
  CCA_REMARKS: "Ghi chú trên chứng từ CCA.",
  VERSION_NO: "Số phiên bản của bản ghi hoặc chứng từ vận đơn.",
  EXCLUDE_BILLING: "Cờ cho biết vận đơn có được loại khỏi quy trình lập hóa đơn hay không.",
};

const TABLE_BUSINESS_OBJECTS = {
  AOS_REGIONS: "cấu hình vùng AOS",
  BSA_MASTER: "cấu hình BSA",
};

const AOS_REGIONS_DESCRIPTIONS = {
  REC_TYPE: "Loại bản ghi của cấu hình vùng AOS.",
  CODE: "Mã vùng AOS.",
  NAME: "Tên vùng AOS.",
  LAST_USER_ID: "Mã người dùng cập nhật cấu hình vùng AOS gần nhất.",
  LAST_UPDATE_DATE: "Thời điểm cập nhật cấu hình vùng AOS gần nhất.",
};

const COMMON_FIELD_DESCRIPTIONS = {
  CITY_OF_OPERATION: "Mã thành phố nơi hoạt động khai thác được thực hiện.",
  BOOKED_AIRLINE: "Mã hãng hàng không được đặt chỗ trên giao dịch.",
  SALE_UPLIFT_FLG: "Cờ xác định giao dịch bán có phát sinh uplift hay không.",
  CLEARANCE_MONTH: "Tháng thực hiện quyết toán giao dịch.",
  BILLING_AIRLINE: "Mã hãng hàng không chịu trách nhiệm lập hóa đơn.",
  STATION_SEQ: "Số thứ tự của trạm trong tuyến hoặc quy trình xử lý.",
  UPLIFT_STATION: "Mã trạm thực hiện uplift cho chuyến bay.",
  FROM_SECTOR: "Mã điểm đi của chặng bay.",
  TO_SECTOR: "Mã điểm đến của chặng bay.",
  ISS_AIRLINE: "Mã hãng hàng không phát hành chứng từ hoặc giao dịch.",
  RC_AIRLINE: "Mã hãng hàng không liên quan đến việc nhận chứng từ hoặc giao dịch.",
  FOP_FOR_IDENTIFIER: "Mã định danh phương thức thanh toán áp dụng cho giao dịch.",
  LAST_UPDATE_PROGRAM: "Tên chương trình thực hiện cập nhật bản ghi gần nhất.",
  PERIOD_FROM: "Thời điểm bắt đầu của kỳ áp dụng.",
  MEMO_AMT: "Số tiền của memo trong giao dịch.",
  REPORTING_AGENCY: "Mã đại lý hoặc đơn vị thực hiện báo cáo.",
  RETURN_KEY: "Khóa dùng để liên kết bản ghi hoàn trả với giao dịch liên quan.",
  MAIN_GSA: "Mã đại lý GSA chính của cấu hình đại lý.",
  BOOKED_RBD: "Mã booking designator được sử dụng khi đặt chỗ.",
  MARKETING_CARRIER: "Mã hãng hàng không tiếp thị chuyến bay.",
  DOC_REF: "Mã tham chiếu của chứng từ liên quan.",
  IS_ONLINE: "Cờ xác định giao dịch hoặc cấu hình được xử lý trực tuyến.",
  CLASS: "Hạng dịch vụ hoặc hạng đặt chỗ áp dụng cho giao dịch.",
  MARKETING_FB: "Mã FB marketing áp dụng cho tuyến hoặc giao dịch.",
  RC_BUSINESS_UNIT: "Mã đơn vị kinh doanh tiếp nhận giao dịch.",
  FOP_FOR_DESC: "Mô tả phương thức thanh toán áp dụng cho giao dịch.",
  CREATED_BY: "Mã người dùng tạo bản ghi.",
  MONTH_RCVD: "Tháng tiếp nhận bản ghi hoặc chứng từ.",
  FARE_PENALTY: "Mức phạt áp dụng cho điều kiện giá vé.",
  DEFAULT_COMM_PERC: "Tỷ lệ hoa hồng mặc định áp dụng cho giao dịch.",
  CHECK_DIGIT: "Chữ số kiểm tra của mã hoặc số chứng từ.",
  CC_COMN_PERC: "Tỷ lệ hoa hồng áp dụng cho giao dịch thẻ tín dụng.",
  ORIG_ISSUE_AGENT: "Mã đại lý phát hành chứng từ ban đầu.",
  REF_CHECK_DIGIT: "Chữ số kiểm tra của mã tham chiếu.",
  COUPON_SEQUENCE: "Số thứ tự coupon trong chứng từ vé.",
  REVERSE_ENTRY: "Cờ xác định giao dịch có phải là bút toán đảo hay không.",
  AI_FC_F_CPNS: "Số coupon hạng F thuộc nhóm AI_FC của bản ghi uplift.",
  AI_FC_C_CPNS: "Số coupon hạng C thuộc nhóm AI_FC của bản ghi uplift.",
  IS_LOCKED: "Cờ xác định bản ghi đã bị khóa hay chưa.",
  REJ_STAGE: "Giai đoạn xử lý từ chối của giao dịch.",
  CURR_OF_LISTING: "Mã tiền tệ niêm yết của giao dịch.",
  REVENUE: "Doanh thu ghi nhận cho giao dịch.",
  REC_SERIAL: "Số serial của bản ghi.",
  IATA_FARE_BASIS: "Mã cơ sở giá vé theo chuẩn IATA.",
  MILEAGE: "Khoảng cách đường bay dùng trong tính toán giao dịch.",
  CC_INFO_REQD: "Cờ xác định giao dịch có yêu cầu thông tin thẻ tín dụng hay không.",
  MONTH_PROCESSED: "Tháng xử lý bản ghi hoặc giao dịch.",
  COMM_PENALTY: "Mức phạt hoa hồng áp dụng cho giao dịch.",
  AREA_OF_OPERATION: "Khu vực khai thác áp dụng cho đại lý hoặc giao dịch.",
  TRANSACTION_STAGE: "Giai đoạn xử lý của giao dịch.",
  APPLICABLE_ORC_STRING: "Chuỗi ORC áp dụng cho giao dịch.",
  ORIG_DATE_OF_ISSUE: "Ngày phát hành ban đầu của chứng từ.",
  REF_DOC_COUPONS: "Số lượng coupon thuộc chứng từ tham chiếu.",
  CARRIER_AUDIT_CPN: "Coupon dùng để đối soát với hãng vận chuyển.",
  INTERLINE_APPL: "Cờ xác định giao dịch có áp dụng interline hay không.",
  SRNO: "Số serial của bản ghi hoặc chứng từ.",
  BILLED_CPN_GROSS_VALUE_COL: "Tổng giá trị của coupon đã lập hóa đơn.",
  CURR_OF_SALE: "Mã tiền tệ của giao dịch bán.",
  DATE_OF_ISSUE: "Ngày phát hành chứng từ.",
  ANCILLARY_SERVICES: "Thông tin dịch vụ bổ trợ đi kèm giao dịch.",
  FR_ATTRIBUTE_1: "Thuộc tính FR thứ nhất của tuyến hoặc giao dịch.",
  SALES_SOURCE: "Nguồn phát sinh giao dịch bán.",
  TXN_SOURCE: "Nguồn phát sinh giao dịch.",
  INTERNAL_COMMENTS: "Ghi chú nội bộ của giao dịch hoặc chứng từ.",
  COUNTRY_OF_ISSUE: "Mã quốc gia phát hành chứng từ.",
  MCO_UTIL_FOR: "Mã đối tượng sử dụng MCO.",
  ORIG_TKTD_FB: "Mã fare basis của vé gốc.",
  AI_EBT_CPNS: "Số coupon EBT thuộc nhóm AI của bản ghi uplift.",
  BILLED_CPN_TAX_AMT_COL: "Số thuế của coupon đã lập hóa đơn.",
  ORIGINAL_PMI: "Mã PMI gốc của chứng từ.",
  PW: "Giá trị PW của bản ghi hiệu lực.",
  TRANSFERRED_INWARD: "Cờ xác định bản ghi đã được chuyển vào inward register hay chưa.",
  REPORTING_AREA_OF_OPERATION: "Khu vực khai thác dùng cho báo cáo.",
  QCED_ON: "Thời điểm QCED của memo.",
  AUTO_PROCESS: "Cờ xác định giao dịch có được xử lý tự động hay không.",
  SOURCE: "Nguồn phát sinh của bản ghi.",
  PLACE_OF_ISSUE: "Địa điểm phát hành chứng từ.",
  UTIL_PAX_COUNT: "Số hành khách sử dụng giá trị util.",
  FARE_BASIS_TD: "Mã cơ sở giá vé TD của giao dịch.",
  VAT_TAX: "Số thuế VAT của giao dịch.",
  MCO_CPNS: "Số coupon MCO của bản ghi uplift.",
  BILLED_TO_MARKETING: "Cờ xác định khoản billing được ghi nhận cho hãng tiếp thị hay không.",
  BILLED_HANDLING_FEE_AMT_COL: "Số phí handling đã lập hóa đơn.",
  VALIDATED_PMI: "Mã PMI đã được kiểm tra hợp lệ.",
  MCO_UTIL: "Mã util của MCO.",
  CREDIT_SALES_AGENT: "Mã đại lý bán theo hình thức credit.",
  QCED_COMMENTS: "Ghi chú liên quan đến QCED của memo.",
  RECO_APPLICABLE: "Cờ xác định quy tắc reconciliation có áp dụng hay không.",
  PNR_BASED_TRANSACTION: "Cờ xác định giao dịch được xác định theo PNR hay không.",
  FOP_PERCENTAGE: "Tỷ lệ phân bổ của phương thức thanh toán.",
  ISI: "Giá trị ISI của chứng từ hoặc giao dịch.",
  OWB_TRANSFER: "Cờ xác định chứng từ OWB đã được chuyển hay chưa.",
  EXCHANGE_DIFF: "Chênh lệch tỷ giá của giao dịch.",
  APPLICABLE_TAX_DATA_SOURCE: "Nguồn dữ liệu thuế áp dụng cho giao dịch.",
  OC_FC_F_CPNS: "Số coupon hạng F thuộc nhóm OC_FC của bản ghi uplift.",
  OC_FC_C_CPNS: "Số coupon hạng C thuộc nhóm OC_FC của bản ghi uplift.",
  BILLED_CPN_TAX_AMT_COB: "Số thuế coupon đã lập hóa đơn theo COB.",
  ISC_PER: "Tỷ lệ ISC áp dụng cho giao dịch.",
  TOD_ORIG: "Điểm đến ban đầu của chặng bay.",
  COUPON_ROUT_1: "Tuyến coupon thứ nhất của chứng từ.",
  CONS_APPLIED: "Cờ xác định khoản concession đã được áp dụng hay chưa.",
  PCI_COMPLIANCE: "Cờ xác định giao dịch tuân thủ PCI hay không.",
  SWT_ATTRIB1: "Thuộc tính thứ nhất của bản ghi sales work.",
  TFF_ATTRIBUTE1: "Thuộc tính thứ nhất của bản ghi TFF.",
  NET_FARE: "Giá vé thuần sau các khoản điều chỉnh.",
  DATE_OF_REFUND: "Ngày hoàn tiền của chứng từ.",
  NP_VALUE_WO_OWN_PROV: "Giá trị NP không bao gồm phần provision của đơn vị sở hữu.",
  PUB_TAX_CURRENCY_1: "Mã tiền tệ công bố cho khoản thuế thứ nhất.",
  OC_EBT_CPNS: "Số coupon EBT thuộc nhóm OC của bản ghi uplift.",
  BILLED_HANDLING_FEE_AMT_COB: "Số phí handling đã lập hóa đơn theo COB.",
  CPN_GROSS_VALUE_COB: "Tổng giá trị coupon theo COB.",
  TOD_DEST: "Điểm đến của chặng bay.",
  TAX_PAYOUT: "Khoản thuế payout của giao dịch.",
  STAT_INDICATOR_REP: "Chỉ báo thống kê dùng cho báo cáo.",
  GSA_CONTROLLING_AGENT: "Mã đại lý GSA kiểm soát giao dịch.",
  SWT_ATTRIB2: "Thuộc tính thứ hai của bản ghi sales work.",
  TFF_ATTRIBUTE2: "Thuộc tính thứ hai của bản ghi TFF.",
  EQUIV_CUR_OF_SALE: "Mã tiền tệ tương đương của giao dịch bán.",
  TRANSFER_TAX_ON_REISSUED_TKT: "Khoản thuế chuyển sang vé được cấp lại.",
  UTIL_CURR: "Mã tiền tệ của giá trị util.",
  PUB_TAX_CURRENCY_2: "Mã tiền tệ công bố cho khoản thuế thứ hai.",
  OC_MCO_CPNS: "Số coupon MCO thuộc nhóm OC của bản ghi uplift.",
  BILLED_OTHER_COMM_AMT_COB: "Số tiền hoa hồng khác đã lập hóa đơn theo COB.",
  HANDLING_FEE_AMT_COB: "Số phí handling theo COB.",
  EXCHANGE_SC: "Thông tin exchange SC của giao dịch.",
  SALE_SOURCE: "Nguồn phát sinh giao dịch bán.",
  ACCRUAL_MONTH_CLOSED: "Tháng accrual đã được đóng.",
  AREA_OF_SALE: "Khu vực phát sinh giao dịch bán.",
  VOID: "Cờ xác định chứng từ đã bị hủy hay chưa.",
  AUDIT_SECTOR_FARE: "Giá vé của chặng bay dùng cho đối soát.",
  BATCH_HDR_KEY1: "Khóa header batch thứ nhất.",
  DE_AI_EBT_CPNS: "Số coupon EBT thuộc nhóm DE_AI của bản ghi uplift.",
  BILLED_UATP_AMT_COB: "Số tiền UATP đã lập hóa đơn theo COB.",
  ISC_AMT_COB: "Số tiền ISC theo COB.",
  CLASS_OF_TRAVEL: "Hạng dịch vụ của chuyến bay.",
  TASK_TRANSFERRED: "Cờ xác định task đã được chuyển hay chưa.",
  FPTP: "Mã FPTP của phương thức thanh toán.",
  DEDUCT_Y_N: "Cờ xác định có khấu trừ hay không.",
  BOID: "Mã định danh bản ghi BO.",
  AUDIT_NET_FARE: "Giá vé thuần dùng cho đối soát.",
  BATCH_HDR_KEY2: "Khóa header batch thứ hai.",
  DE_MCO_CPNS: "Số coupon MCO thuộc nhóm DE của bản ghi uplift.",
  BILLED_VAT_AMT_COB: "Số tiền VAT đã lập hóa đơn theo COB.",
  OTHER_COMM_AMT_COB: "Số tiền hoa hồng khác theo COB.",
  ONLINE_ORIGIN: "Nguồn phát sinh trực tuyến của giao dịch.",
  IS_BSP_LINK: "Cờ xác định có liên kết BSP hay không.",
  RPT_FPAM: "Thông tin FPAM dùng cho báo cáo.",
  TYPE_OF_SALE: "Loại giao dịch bán.",
  MCO_PAX_AVAILABLE: "Số hành khách còn khả dụng trong MCO.",
  BATCH_HDR_KEY3: "Khóa header batch thứ ba.",
  DE_OC_FC_F_CPNS: "Số coupon hạng F thuộc nhóm DE_OC_FC của bản ghi uplift.",
  BILLED_CPN_TOT_AMT_COB: "Tổng số tiền coupon đã lập hóa đơn theo COB.",
  UATP_AMT_COB: "Số tiền UATP theo COB.",
  ONLINE_DESTINATION: "Điểm đến của giao dịch trực tuyến.",
  FPAC: "Mã FPAC của phương thức thanh toán.",
  ATLANTIC_PACIFIC: "Cờ hoặc mã phân loại tuyến Atlantic-Pacific.",
  MCO_PAX_UTILISED: "Số hành khách đã sử dụng MCO.",
  BATCH_HDR_KEY4: "Khóa header batch thứ tư.",
  DE_OC_FC_C_CPNS: "Số coupon hạng C thuộc nhóm DE_OC_FC của bản ghi uplift.",
  BILLED_ISC_PER: "Tỷ lệ ISC đã lập hóa đơn.",
  VAT_AMT_COB: "Số tiền VAT theo COB.",
  COMMISSION: "Khoản hoa hồng của giao dịch.",
  DATA_CORRECT_REPRORATION: "Cờ xác định dữ liệu đã được phân bổ lại chính xác hay chưa.",
  USAGE_TAXES: "Các khoản thuế theo mức sử dụng.",
  BATCH_HDR_KEY5: "Khóa header batch thứ năm.",
  DE_OC_FC_Y_CPNS: "Số coupon hạng Y thuộc nhóm DE_OC_FC của bản ghi uplift.",
  BILLED_OTHER_COMM_PER: "Tỷ lệ hoa hồng khác đã lập hóa đơn.",
  CPN_TOT_AMT_COB: "Tổng số tiền coupon theo COB.",
  OVERRIDING_COMMISSION: "Khoản hoa hồng override áp dụng cho giao dịch.",
  PRORATION_METHOD: "Phương pháp phân bổ giá vé hoặc doanh thu.",
  IO_JOURNEY: "Thông tin hành trình IO của chặng bay.",
  BATCH_HDR_KEY6: "Khóa header batch thứ sáu.",
  DE_OC_EBT_CPNS: "Số coupon EBT thuộc nhóm DE_OC của bản ghi uplift.",
  BILLED_UATP_PER: "Tỷ lệ UATP đã lập hóa đơn.",
  CPN_GROSS_VALUE_COS: "Tổng giá trị coupon theo COS.",
  ADJUSTMENT: "Khoản điều chỉnh của giao dịch.",
  SPECIFIED_MCO: "Mã MCO được chỉ định cho chứng từ.",
  CODE_SHARE_CARRIER: "Mã hãng hàng không trong quan hệ code share.",
  YQ_YR_RESIDUAL: "Số dư phụ phí YQ/YR còn lại.",
  DE_OC_MCO_CPNS: "Số coupon MCO thuộc nhóm DE_OC của bản ghi uplift.",
  FIM_RESERVE_AMT_LIST: "Danh sách số tiền reserve của FIM.",
  CPN_TAX_AMT_COS: "Số thuế coupon theo COS.",
  DISCOUNT_SC: "Khoản giảm giá theo SC.",
  RETURN_AGENT: "Mã đại lý xử lý hoàn trả.",
  SRP_METHOD: "Phương pháp SRP áp dụng cho giao dịch.",
  VAT_LESS_AMT_ON_PRO_TAX_LC: "Số tiền VAT giảm trên khoản thuế theo LC.",
 ORDER_OF_FLIGHT: "Thứ tự chuyến bay trong lịch khai thác.",
  FEEDING_CARRIER: "Hãng hàng không cung cấp hoặc nối chuyến.",
  RM_TRANSFERRED: "Cờ xác định RM đã được chuyển tiếp.",
  ERT_ATTRIBUTE_1: "Thuộc tính mở rộng thứ nhất của ERT.",
  FNF_PRORATION_ERROR: "Mã lỗi phân bổ FNF.",
  NET_STOPOVER: "Số điểm dừng trung gian thuần của hành trình.",
  MATCHED_GROSS: "Giá trị tổng đã đối sánh.",
  TS_NP_VALUE_COB: "Giá trị NP đối soát theo COB.",
  SUPER_COMM_AMT_COS: "Số tiền hoa hồng siêu cấp theo COS.",
  STAT_FBC: "Trạng thái FBC của giao dịch.",
  TCN_FARE: "Thông tin giá vé TCN của giao dịch.",
  FARE_OWNER_ARLN: "Hãng hàng không sở hữu giá vé.",
  FLIGHT_ATTRIBUTE_5: "Thuộc tính mở rộng thứ năm của chuyến bay.",
  TS_AUDIT_ORC_AMT_COB: "Số tiền ORC đối soát theo COB.",
  SC_AMT_CURR: "Loại tiền của số tiền SC.",
  NATIONAL_FOREIGNER: "Cờ hoặc phân loại hành khách quốc tịch nước ngoài.",
  FDR_USED: "Cờ xác định đã sử dụng FDR.",
  TICKETED_FARE_SRP: "Giá vé SRP của vé đã xuất.",
  FLIGHT_ATTRIBUTE_4: "Thuộc tính mở rộng thứ tư của chuyến bay.",
  TS_AUDIT_COMMISSION_AMT_COB: "Số tiền hoa hồng đối soát theo COB.",
  SRC_UTIL: "Mức sử dụng nguồn của giao dịch.",
  ROUTE_INT_DOM: "Phân loại chặng bay quốc tế hoặc nội địa.",
  TICKET_SOURCE: "Nguồn phát hành hoặc tiếp nhận vé.",
  HF_BASED_ON: "Cơ sở tính HF của giao dịch.",
  FLIGHT_ATTRIBUTE_3: "Thuộc tính mở rộng thứ ba của chuyến bay.",
  TS_AUDIT_DISCOUNT_AMT_COB: "Số tiền giảm giá đối soát theo COB.",
  OUTWARD_SUPER_COMM_BILLING: "Thông tin lập hóa đơn hoa hồng siêu cấp đầu ra.",
  HDR_KEY3: "Khóa header thứ ba của bản ghi.",
  ISR_REMT: "Thông tin ISR của khoản remittance.",
  ISC_BASED_ON: "Cơ sở tính ISC của giao dịch.",
  FLIGHT_ATTRIBUTE_2: "Thuộc tính mở rộng thứ hai của chuyến bay.",
  TS_AUDIT_NET_FARE_COB: "Giá vé thuần chặng bay COB dùng cho đối soát.",
  DISCOUNT_PER: "Tỷ lệ giảm giá của coupon hoặc giao dịch.",
  HDR_KEY2: "Khóa header thứ hai của bản ghi.",
  ISR_NTFA: "Thông tin ISR của giá vé thuần.",
  ISC_CLEARING_HOUSE: "Cờ xác định giao dịch ISC thuộc clearing house.",
  FLIGHT_ATTRIBUTE_1: "Thuộc tính mở rộng thứ nhất của chuyến bay.",
  TS_AUDIT_SECTOR_FARE_COB: "Giá vé chặng bay COB dùng cho đối soát TS.",
  HF_EXCEPTION_RAISED: "Cờ xác định đã phát sinh ngoại lệ HF.",
  HDR_KEY1: "Khóa header thứ nhất của bản ghi.",
  TCN_ETTS: "Thông tin TCN-ETTS của giao dịch.",
  FNF_RECORD50_ERROR: "Mã lỗi record 50 của FNF.",
  NON_REV_CARGO: "Cờ hoặc giá trị hàng hóa không tạo doanh thu.",
  TS_AUDIT_NET_FARE: "Giá vé thuần dùng cho đối soát TS.",
  VAT_EXCEPTION_RAISED: "Cờ xác định đã phát sinh ngoại lệ VAT.",
  OTHER_REVENUE_BASE: "Cơ sở tính doanh thu khác.",
  TCN_APBC: "Thông tin TCN-APBC của giao dịch.",
  IS_FNF_COUPON: "Cờ xác định coupon thuộc FNF.",
  MAIL: "Thông tin thư điện tử liên quan đến bản ghi.",
  TS_AUDIT_SECTOR_FARE: "Giá vé chặng bay dùng cho đối soát TS.",
  UATP_EXCEPTION_RAISED: "Cờ xác định đã phát sinh ngoại lệ UATP.",
  ADDNL_ORC_AMT_LC: "Số tiền ORC bổ sung theo LC.",
  TCN_NRID: "Thông tin TCN-NRID của giao dịch.",
  ATA_LOCAL_FARE_IN_NUC: "Giá vé địa phương ATA đầu vào quy đổi theo NUC.",
  LEG_MARKET: "Thị trường của chặng bay.",
  TS_ACH_FACTOR: "Hệ số ACH của giao dịch TS.",
  OC_EXCEPTION_RAISED: "Cờ xác định đã phát sinh ngoại lệ OC.",
  ADDNL_ORC_AMT_SC: "Số tiền ORC bổ sung theo SC.",
  TCN_EFCO: "Thông tin TCN-EFCO của giao dịch.",
  FINAL_QUOTIENT: "Thương số cuối cùng của phép tính phân bổ.",
  OPERATIONAL_SUFFIX: "Hậu tố nhận diện khai thác của chuyến bay.",
  TS_LINE_OF_BUSINESS: "Lĩnh vực kinh doanh của giao dịch TS.",
  TAX_EXCEPTION_RAISED: "Cờ xác định đã phát sinh ngoại lệ thuế.",
  APPL_ORC_AMT_LC: "Số tiền ORC áp dụng theo LC.",
  TCN_AEBA: "Thông tin TCN-AEBA của giao dịch.",
  SPA_ATBP_RTG_CMPR_CURR: "Loại tiền so sánh tỷ lệ SPA và ATBP.",
  Y_BLOCK_CAPACITY: "Sức chứa block khai thác ở hạng Y.",
  TS_FLAT_AMT_CURR: "Loại tiền của khoản tiền cố định TS.",
  ISC_EXCEPTION_RAISED: "Cờ xác định đã phát sinh ngoại lệ ISC.",
  APPL_ORC_AMT_SC: "Số tiền ORC áp dụng theo SC.",
  TCN_EQFR: "Thông tin TCN-EQFR của giao dịch.",
  NET_ATBP: "Giá trị ròng ATBP.",
  F_BLOCK_CAPACITY: "Sức chứa block khai thác ở hạng F.",
  TS_FARE_BASIS_TD: "Mã cơ sở giá vé của TD.",
  GROSS_EXCEPTION_RAISED: "Cờ xác định đã phát sinh ngoại lệ tổng.",
  ORC_AMT_LC: "Số tiền ORC theo LC.",
  TCN_TDAM: "Thông tin TCN-TDAM của giao dịch.",
  HIGH_Y_FARE: "Giá vé hạng Y cao nhất.",
  C_BLOCK_CAPACITY: "Sức chứa block khai thác ở hạng C.",
  TS_ORIG_TKTD_FB: "Thông tin nguồn gốc TKTD FB.",
  QC_REQUIRED: "Cờ xác định bản ghi cần kiểm tra chất lượng.",
  ORC_AMT_SC: "Số tiền ORC theo SC.",
  LABEL: "Nhãn mô tả của vé hoặc giao dịch.",
  ACH_FACTOR: "Hệ số ACH của chặng bay.",
  FLIGHT_SOURCE: "Nguồn dữ liệu chuyến bay.",
  TM_LINE_OF_BUSINESS: "Lĩnh vực kinh doanh của giao dịch TM.",
  BASE_MPA_SPA_CURR: "Loại tiền cơ sở của MPA hoặc SPA.",
  OTHER_ADJ_ORC_SC: "Khoản ORC điều chỉnh khác theo SC.",
  NET_FARE_DERIVATION: "Quy tắc hoặc thông tin hình thành giá vé thuần.",
  BASE_SPA_PRORATE: "Giá trị SPA cơ sở dùng để phân bổ.",
  CH_CAPTURE_COMPLETE: "Cờ xác định hoàn tất thu nhận dữ liệu CH.",
  TM_PLACE_OF_SALE: "Địa điểm bán vé của giao dịch TM.",
  UATP_PER: "Tỷ lệ UATP của giao dịch.",
  OTHER_ADJ_ORC: "Khoản ORC điều chỉnh khác.",
  DATA_FOUNDATION: "Nền tảng dữ liệu của giao dịch.",
  IND_CPBC: "Cờ xác định có áp dụng CPBC.",
  FLIGHT_PACK_RECEIVED: "Cờ xác định đã nhận gói dữ liệu chuyến bay.",
  TM_TRUE_POT: "Giá trị POT thực tế của giao dịch TM.",
  OTHER_COMM_PER: "Tỷ lệ hoa hồng khác.",
  OTHER_ADJ_COMM_SC: "Khoản hoa hồng điều chỉnh khác theo SC.",
  FARE_TEXT: "Nội dung mô tả giá vé.",
  LINE_OF_BUSINESS: "Lĩnh vực kinh doanh của giao dịch.",
  TM_ONLINE_POT: "Thông tin POT phát sinh từ kênh trực tuyến TM.",
  FARE_BASIS: "Mã cơ sở giá vé.",
  OTHER_ADJ_COMM: "Khoản hoa hồng điều chỉnh khác.",
  IT_CODE_OUT: "Mã IT đầu ra.",
  CPBC: "Mã hoặc giá trị CPBC của chặng bay.",
  THRU_SECTORS: "Các chặng bay liên tục trong hành trình.",
  TM_ONLINE_DESTINATION: "Điểm đến của giao dịch trực tuyến TM.",
  LAST_UPDATE_USER: "Tài khoản cập nhật bản ghi lần cuối.",
  OTHER_ADJ_DISC_SC: "Khoản chiết khấu điều chỉnh khác theo SC.",
  NET_FARE_OUT: "Giá vé thuần đầu ra.",
  OPER_FLIGHT: "Chuyến bay được khai thác.",
  FLIGHT_ESTIMATION: "Thông tin ước tính chuyến bay.",
  TM_ONLINE_ORIGIN: "Điểm khởi hành của giao dịch trực tuyến TM.",
  AIRLINE_OWN_USE: "Cờ xác định giao dịch do hãng hàng không tự sử dụng.",
  OTHER_ADJ_DISC: "Khoản chiết khấu điều chỉnh khác.",
  PLACE_OF_SALE: "Địa điểm bán vé.",
  OPER_CARRIER: "Hãng hàng không khai thác chặng bay.",
  TRAFFIC_RIGHTS: "Quyền khai thác thương quyền trên chặng bay.",
  TM_TICKETED_DESTINATION: "Điểm đến của vé TM đã xuất.",
  REF_FIELD5: "Trường tham chiếu mở rộng thứ năm của coupon.",
  OTHER_ADJ_GROSS_SC: "Tổng điều chỉnh khác theo SC.",
  CARRIER_LIST: "Danh sách hãng hàng không tham gia hành trình.",
  FLAT_AMT_CURR: "Loại tiền của khoản tiền cố định.",
  PILOT_DATA_RECEIVED: "Cờ xác định đã nhận dữ liệu phi công.",
  TM_TICKETED_ORIGIN: "Điểm khởi hành của vé TM đã xuất.",
  REF_FIELD4: "Trường tham chiếu mở rộng thứ tư của coupon.",
  OTHER_ADJ_GROSS: "Tổng điều chỉnh khác trước các khoản khấu trừ.",
  ROE_USED: "Tỷ giá quy đổi được sử dụng.",
  FNF_ISC_PERCENTAGE: "Tỷ lệ ISC FNF của giao dịch.",
  FUEL_UNIT: "Đơn vị nhiên liệu của chuyến bay.",
  TM_RETURN_CURR: "Loại tiền dùng cho khoản hoàn trả TM.",
  REF_FIELD3: "Trường tham chiếu mở rộng thứ ba của coupon.",
  DISC_PERCENTAGE: "Tỷ lệ giảm giá của giao dịch.",
  PNR: "Mã đặt chỗ của hành khách.",
  DISC_APPL_ON: "Đối tượng áp dụng khoản giảm giá.",
  BLOCK_FLYING_HR: "Số giờ bay của block khai thác.",
  TM_RETURN_AGENT: "Mã đại lý xử lý hoàn trả của giao dịch TM.",
  REF_FIELD2: "Trường tham chiếu mở rộng thứ hai của coupon.",
  ISC_PERCENTAGE: "Tỷ lệ ISC của giao dịch.",
  IGNORE_FC: "Cờ xác định có bỏ qua FC hay không.",
  HANDLING_FEE: "Khoản phí xử lý của giao dịch.",
  GEOG_DIRECTION: "Hướng địa lý của chặng bay.",
  TM_SALES_SOURCE: "Nguồn bán hàng của giao dịch TM.",
  REF_FIELD1: "Trường tham chiếu mở rộng thứ nhất của coupon.",
  ORC_SC: "Khoản ORC theo SC.",
  PARTICIPANTS_STOCK: "Thông tin cổ phần của các bên tham gia.",
  FREE_BAGGAGE_ALLOWANCE: "Định mức hành lý miễn cước.",
  FLIGHT_DIRECTION: "Hướng khai thác của chuyến bay.",
  TM_AREA_OF_SALE: "Khu vực bán hàng của giao dịch TM.",
  NO_OF_ATTACHMENTS: "Số lượng chứng từ đính kèm.",
  AIRCRAFT_REG: "Số đăng ký của tàu bay.",
  IT_CODE_IN: "Mã IT đầu vào.",
  SPA_RESIDUAL: "Số dư SPA còn lại.",
  SCANNED_DOC_CNT: "Số lượng chứng từ đã quét.",
  SAMP_CONSTANT: "Hằng số SAMP dùng trong xử lý giao dịch.",
  ATTACHMENT_INDICATOR_VALIDATED: "Cờ xác định chứng từ đính kèm đã được kiểm tra.",
  AUDIT_DISCOUNT_SC: "Khoản giảm giá theo SC dùng cho đối soát.",
  NET_SERIAL_IN: "Số serial thuần đầu vào.",
  MPA_RESIDUAL: "Số dư MPA còn lại.",
  Y_CAPACITY: "Sức chứa của chuyến bay ở hạng Y.",
  MARK_FORMC_MANUAL: "Cờ xác định biểu mẫu C được đánh dấu thủ công.",
  ATTACHMENT_INDICATOR_ORIGINAL: "Cờ xác định chứng từ đính kèm là bản gốc.",
  AUDIT_DISCOUNT: "Khoản giảm giá dùng cho đối soát.",
  NET_FARE_IN: "Giá vé thuần đầu vào.",
  UATP_DISCOUNT: "Khoản giảm giá UATP.",
  C_CAPACITY: "Sức chứa của chuyến bay ở hạng C.",
  TRANSACTION_ORIGIN: "Nguồn phát sinh giao dịch.",
  CPN_TOT_AMT_COS: "Tổng số tiền coupon theo COS.",
  AUDIT_COMMISSION_SC: "Khoản hoa hồng theo SC dùng cho đối soát.",
  NET_CURRENCY_IN: "Loại tiền của giá trị thuần đầu vào.",
  NETS_OA: "Giá trị ròng OA của giao dịch.",
  YQ_YR_RESIDUAL_OC_CPNS: "Số dư phụ phí YQ/YR của coupon nhóm OC.",
  F_CAPACITY: "Sức chứa của chuyến bay ở hạng F.",
  VALIDATION_REJECTED: "Cờ xác định bản ghi bị từ chối khi kiểm tra dữ liệu.",
  VAT_AMT_COS: "Số tiền VAT theo COS.",
  AUDIT_COMMISSION: "Khoản hoa hồng dùng cho đối soát.",
  ENDORSEMENTS: "Thông tin điều kiện hoặc ghi chú xác nhận trên vé.",
  FB_TRANS_METHOD: "Phương thức chuyển nhượng FB.",
  ATTRIBUTE5: "Thuộc tính mở rộng thứ năm của chi tiết thuế.",
  FLYING_DISTANCE: "Khoảng cách bay của chặng hoặc chuyến bay.",
  IS_CLEARING_HOUSE: "Cờ xác định giao dịch thuộc clearing house.",
  UATP_AMT_COS: "Số tiền UATP theo COS.",
  TRUE_POT: "Giá trị POT thực tế của giao dịch.",
  NOT_VALID_AFTER: "Ngày kết thúc hiệu lực của vé hoặc chặng bay.",
  ATTRIBUTE4: "Thuộc tính mở rộng thứ tư của chi tiết thuế.",
  FLYING_HRS: "Số giờ bay của chặng hoặc chuyến bay.",
  AGREEMENT_INDICATOR_VALIDATED: "Cờ xác định thông tin thỏa thuận đã được kiểm tra.",
  OTHER_COMM_AMT_COS: "Số tiền hoa hồng khác theo COS.",
  ONLINE_POT: "Thông tin POT phát sinh từ kênh trực tuyến.",
  TICKETED_DESTINATION: "Điểm đến của vé đã xuất.",
  NOT_VALID_BEFORE: "Ngày bắt đầu trước đó mà vé hoặc chặng bay chưa có hiệu lực.",
  ATTRIBUTE3: "Thuộc tính mở rộng thứ ba của chi tiết thuế.",
  PAYLOAD: "Nội dung dữ liệu tải lên của bản ghi.",
  AGREEMENT_INDICATOR_SUPPLIED: "Cờ xác định đã cung cấp thông tin thỏa thuận.",
  ISC_AMT_COS: "Số tiền ISC theo COS.",
  CABIN: "Hạng dịch vụ của chuyến bay.",
  TICKETED_ORIGIN: "Điểm khởi hành của vé đã xuất.",
  AIRLINE_SHARE: "Thông tin phân bổ chặng bay giữa các hãng hàng không.",
  ATTRIBUTE2: "Thuộc tính mở rộng thứ hai của chi tiết thuế.",
  CREW: "Thông tin tổ bay phục vụ chuyến bay.",
  FIM_RESERVE_AMT_DIFF_LIST: "Danh sách chênh lệch số tiền reserve của FIM.",
  HANDLING_FEE_AMT_COS: "Số tiền phí xử lý theo COS.",
  COMMISSION_SC: "Khoản hoa hồng theo SC.",
  RETURN_CURR: "Loại tiền dùng cho khoản hoàn trả.",
  AIRLINE_THROUGHFARE: "Cờ xác định giá vé throughfare của hãng hàng không.",
  ATTRIBUTE1: "Thuộc tính mở rộng thứ nhất của chi tiết thuế.",
  LT_OP_DAY: "Ngày vận hành của lịch khai thác.",
  BILLED_ISC_AMT_COB: "Số tiền ISC đã lập hóa đơn theo COB.",
  CPN_TAX_AMT_COB: "Số thuế coupon theo COB.",
  EXCHANGE_LC: "Thông tin exchange LC của giao dịch.",
  CORRID: "Mã correlation của bản ghi.",
  ADM_SOURCE: "Nguồn ADM của memo.",
  EQUIV_FARE: "Giá vé tương đương của chứng từ.",
  DISC_PERCENT: "Tỷ lệ giảm giá của giao dịch.",
  BILLED_ISC_AMT_COL: "Số tiền ISC đã lập hóa đơn.",
  AIRLINE_FLIGHT_DESIGNATOR: "Mã định danh hãng hàng không và số hiệu chuyến bay.",
  DISCOUNT: "Khoản giảm giá áp dụng cho giao dịch.",
  LINKED_DOC_SYS: "Mã hệ thống của chứng từ được liên kết.",
  QC_DONE: "Cờ xác định kiểm tra chất lượng đã hoàn tất hay chưa.",
  CREATE_EXPECTED_RETURNS: "Cờ xác định có tạo khoản hoàn trả dự kiến hay không.",
  TICKET_ARCHIVED: "Cờ xác định vé đã được lưu trữ hay chưa.",
  CHANNEL_OF_SALE: "Kênh phát sinh giao dịch bán.",
  CUR_OF_SALE: "Mã tiền tệ của giao dịch bán.",
  MCO_UTIL_CUR: "Mã tiền tệ của MCO util.",
  OTHER_DIFF: "Chênh lệch khác của giao dịch.",
  TAX_DETAILS: "Chi tiết thuế của giao dịch.",
  BILLED_CPN_GROSS_VALUE_COB: "Tổng giá trị coupon đã lập hóa đơn theo COB.",
  CPN_GROSS_VALUE_COL: "Tổng giá trị của coupon.",
  FREEDOM: "Thông tin quyền tự do vận chuyển áp dụng cho chặng bay.",
  REPORTED_FLOWN_CABIN: "Khoang hành khách được báo cáo là đã khai thác.",
  MASK_REMARKS: "Ghi chú về việc masking của memo.",
  APPLY_CC_FEE: "Cờ xác định có áp dụng phí thẻ tín dụng hay không.",
  TRNN: "Mã tham chiếu giao dịch TRNN.",
  CARD_VERIFICATION_VALUE_RESULT: "Kết quả xác minh giá trị thẻ.",
  GROSS_FARE: "Tổng giá vé trước các khoản giảm trừ.",
  IS_PARSED: "Cờ xác định chứng từ đã được phân tích hay chưa.",
  POINT_OF_TURN: "Điểm quay đầu của chặng bay.",
  TAX_PERCENT: "Tỷ lệ thuế áp dụng cho giao dịch.",
  OC_FC_Y_CPNS: "Số coupon hạng Y thuộc nhóm OC_FC của bản ghi uplift.",
  SUPPRESS_CODE_SHARE: "Cờ xác định có loại trừ xử lý code share hay không.",
  CURR_OF_BILLING: "Mã tiền tệ sử dụng khi lập hóa đơn.",
  AOS: "Mã AOS áp dụng cho bản ghi.",
  PURGE: "Cờ xác định bản ghi có đủ điều kiện loại khỏi dữ liệu hoạt động hay không.",
  SHOW_TOTALS: "Cờ xác định có hiển thị tổng số của memo hay không.",
  CARDBOARD_CHECK: "Cờ xác định kết quả kiểm tra cardboard.",
  SWT_PNR: "Mã PNR của bản ghi sales work.",
  SYS_GEN: "Cờ xác định bản ghi được hệ thống tự sinh hay không.",
  ORIG_PLACE_OF_ISSUE: "Địa điểm phát hành ban đầu của chứng từ.",
  UTIL_VALUE: "Giá trị util áp dụng cho chứng từ hoặc giao dịch.",
  CARRIER_UPLIFTED: "Giá trị uplifted của hãng vận chuyển.",
  TAX_GROUP: "Nhóm thuế áp dụng cho giao dịch.",
  PAX_SELF_TOTAL: "Tổng số hành khách self của bản ghi uplift.",
};

const BSA_MASTER_DESCRIPTIONS = {
  EFFECTIVE_FROM: "Ngày bắt đầu hiệu lực của cấu hình BSA.",
  EFFECTIVE_TO: "Ngày kết thúc hiệu lực của cấu hình BSA.",
  OPERATING_CARRIER_CODE: "Mã hãng hàng không khai thác chuyến bay.",
  OPERATIING_FLIGHT_NO: "Số hiệu chuyến bay do hãng khai thác thực hiện.",
  MARKETING_CARRIER_CODE: "Mã hãng hàng không tiếp thị chuyến bay.",
  MARKETING_FLIGHT_NO: "Số hiệu chuyến bay được hãng tiếp thị công bố.",
  FROM_SECTOR: "Mã điểm đi của chặng bay áp dụng cấu hình BSA.",
  TO_SECTOR: "Mã điểm đến của chặng bay áp dụng cấu hình BSA.",
  C_CABIN_BLOCK_SPACE: "Số chỗ block được phân bổ cho khoang C.",
  Y_CABIN_BLOCK_SPACE: "Số chỗ block được phân bổ cho khoang Y.",
  TOTAL_BLOCK_SPACE: "Tổng số chỗ block được phân bổ cho chặng bay.",
  DAYS_OF_OPERATION: "Các ngày trong tuần mà cấu hình BSA được áp dụng khai thác.",
  F_CABIN_BLOCK_SPACE: "Số chỗ block được phân bổ cho khoang F.",
  WBF_FLAG: "Cờ WBF dùng để xác định trạng thái áp dụng của cấu hình BSA.",
  VICE_VERSA: "Cờ cho biết cấu hình BSA có áp dụng theo chiều ngược lại của chặng bay hay không.",
  U_CABIN_BLOCK_SPACE: "Số chỗ block được phân bổ cho khoang U.",
  LAST_USER_ID: "Mã người dùng cập nhật bản ghi gần nhất.",
  LAST_UPDATE_DATE: "Thời điểm cập nhật bản ghi gần nhất.",
  AIRPORT_TAX1: "Khoản thuế hoặc phí sân bay thứ nhất áp dụng cho chặng bay.",
  AIRPORT_TAX2: "Khoản thuế hoặc phí sân bay thứ hai áp dụng cho chặng bay.",
  COMMITED_SEAT_C_CABIN: "Số chỗ cam kết của khoang C.",
  COMMITED_SEAT_F_CABIN: "Số chỗ cam kết của khoang F.",
  COMMITED_SEAT_U_CABIN: "Số chỗ cam kết của khoang U.",
  COMMITED_SEAT_Y_CABIN: "Số chỗ cam kết của khoang Y.",
  NON_UTIL_PRICE_C_CABIN: "Mức giá non-util của khoang C.",
  NON_UTIL_PRICE_F_CABIN: "Mức giá non-util của khoang F.",
  NON_UTIL_PRICE_U_CABIN: "Mức giá non-util của khoang U.",
  NON_UTIL_PRICE_Y_CABIN: "Mức giá non-util của khoang Y.",
  PRICE_C_CABIN: "Mức giá áp dụng cho khoang C.",
  PRICE_F_CABIN: "Mức giá áp dụng cho khoang F.",
  PRICE_U_CABIN: "Mức giá áp dụng cho khoang U.",
  PRICE_Y_CABIN: "Mức giá áp dụng cho khoang Y.",
  SOFT_BLOCK_PRICE_C_CABIN: "Mức giá soft-block áp dụng cho khoang C.",
  SOFT_BLOCK_PRICE_F_CABIN: "Mức giá soft-block áp dụng cho khoang F.",
  SOFT_BLOCK_PRICE_U_CABIN: "Mức giá soft-block áp dụng cho khoang U.",
  SOFT_BLOCK_PRICE_Y_CABIN: "Mức giá soft-block áp dụng cho khoang Y.",
  CURRENCY_CODE: "Mã tiền tệ áp dụng cho mức giá và khoản phí của cấu hình BSA.",
  PAX_TYPE: "Loại hành khách áp dụng cho cấu hình BSA.",
};

const FIELD_TERM_LABELS = {
  AIRPORT: "sân bay",
  AIRLINE: "hãng hàng không",
  AMOUNT: "số tiền",
  AGENCY: "đại lý",
  CABIN: "khoang hành khách",
  CARRIER: "hãng hàng không",
  CHARGE: "khoản phí",
  CODE: "mã",
  CURRENCY: "tiền tệ",
  DATE: "ngày",
  DAYS: "các ngày",
  EFFECTIVE: "hiệu lực",
  FLIGHT: "chuyến bay",
  FROM: "điểm đi",
  BOOKED: "đặt chỗ",
  BILLING: "lập hóa đơn",
  CLEARANCE: "quyết toán",
  ID: "định danh",
  IND: "chỉ báo",
  ISS: "phát hành",
  KEY: "khóa",
  MARKETING: "tiếp thị",
  OPERATION: "hoạt động khai thác",
  NUMBER: "số",
  OPERATING: "khai thác",
  PAX: "hành khách",
  PERIOD: "kỳ áp dụng",
  PROGRAM: "chương trình",
  PRICE: "mức giá",
  RATE: "tỷ lệ",
  RC: "nhận",
  REGION: "vùng",
  REPORTING: "báo cáo",
  SEAT: "chỗ",
  SECTOR: "chặng bay",
  SEQ: "số thứ tự",
  SPACE: "số chỗ",
  STATION: "trạm",
  STATUS: "trạng thái",
  TIME: "thời điểm",
  TO: "điểm đến",
  UPLIFT: "uplift",
  TYPE: "loại",
  UPDATE: "cập nhật",
  USER: "người dùng",
  FLG: "cờ",
  AMT: "số tiền",
  MONTH: "tháng",
  COUNT: "số lượng",
  TOTAL: "tổng số",
  UNIT: "đơn vị",
  VALUE: "giá trị",
  SOURCE: "nguồn",
};

function tableBusinessObject(table) {
  const name = normalizeIdentifier(table.name);
  if (TABLE_BUSINESS_OBJECTS[name]) return TABLE_BUSINESS_OBJECTS[name];
  if (name === "T_AIR_WAYBILL") return "vận đơn hàng không";
  if (name.includes("CARGO_SPOT_AWB_LOAD")) return "vận đơn hàng không";
  if (name.includes("AWB_PRICING")) return "dòng tính cước của vận đơn";
  if (name.includes("AWB_CHARGE")) return "dòng phụ phí của vận đơn";
  if (name.includes("AIR_WAYBILL_ITEM")) return "mặt hàng trên vận đơn";
  if (name.includes("INVOICE")) return "chứng từ hóa đơn";
  const readableName = name
    .replace(/_(MASTER|DETAIL|HEADER|ITEM|HISTORY|HIST|CONFIG|CONFIGURATION)$/i, "")
    .toLowerCase()
    .replaceAll("_", " ");
  return `bản ghi ${readableName || "nghiệp vụ"}`;
}

function indexedSuffix(columnName) {
  const match = normalizeIdentifier(columnName).match(/_(\d+)$/);
  return match ? Number(match[1]) : null;
}

function readableFieldName(columnName) {
  return normalizeIdentifier(columnName)
    .split("_")
    .map((token) => FIELD_TERM_LABELS[token] ?? token.toLowerCase())
    .join(" ");
}

function semanticDescriptionFallback(column, table) {
  throw new Error(`Thiếu mô tả nghiệp vụ cụ thể cho ${table.schema}.${table.name}.${column.name}`);
}

function semanticDescriptionForColumn(column, table, sampleValues) {
  const name = normalizeIdentifier(column.name);
  const object = tableBusinessObject(table);
  const tableName = normalizeIdentifier(table.name);
  if (COMMON_FIELD_DESCRIPTIONS[name]) return COMMON_FIELD_DESCRIPTIONS[name];
  if (tableName === "AOS_REGIONS" && AOS_REGIONS_DESCRIPTIONS[name]) return AOS_REGIONS_DESCRIPTIONS[name];
  if (tableName === "BSA_MASTER" && BSA_MASTER_DESCRIPTIONS[name]) return BSA_MASTER_DESCRIPTIONS[name];
  if ((tableName === "T_AIR_WAYBILL" || tableName.includes("CARGO_SPOT_AWB_LOAD")) && AIR_WAYBILL_DESCRIPTIONS[name]) return AIR_WAYBILL_DESCRIPTIONS[name];

  const index = indexedSuffix(name);
  const tax = name.match(/^TAX(\d+)_(CODE|RATE|AMOUNT)$/);
  if (tax) {
    const ordinal = { "1": "thứ nhất", "2": "thứ hai", "3": "thứ ba" }[tax[1]] ?? `số ${tax[1]}`;
    const role = { CODE: "Mã loại thuế", RATE: "Thuế suất", AMOUNT: "Số tiền thuế" }[tax[2]];
    return `${role} ${ordinal} áp dụng cho giao dịch.`;
  }

  const otherCharge = name.match(/^OTHER_CHARGES?_(PC|CC|CA|PA)_(CODE|AMOUNT)_(\d+)$/);
  if (otherCharge) {
    const role = otherCharge[2] === "CODE" ? "Mã khoản phụ phí" : "Số tiền của khoản phụ phí";
    return `${role} thuộc nhóm ${otherCharge[1]} thứ ${otherCharge[3]}.`;
  }

  if (name.startsWith("SPECAL_HNDL_CODE_") && index !== null) return `Mã xử lý đặc biệt thứ ${index} của ${object}.`;
  if (name.startsWith("ORG_MCO_NUMBER_") && index !== null) return `Số chứng từ MCO thứ ${index} tại nơi gửi.`;
  if (name.endsWith("_NAME")) return `Tên hiển thị của đối tượng ${name.slice(0, -5).toLowerCase().replaceAll("_", " ")}.`;
  if (name.endsWith("_ADDRESS") || /_ADDRESS_\d+$/.test(name)) return `Địa chỉ của đối tượng ${name.replace(/_ADDRESS(_\d+)?$/, "").toLowerCase().replaceAll("_", " ")}.`;
  if (name.endsWith("_CITY")) return `Mã thành phố hoặc sân bay ${name.replace(/_CITY$/, "").toLowerCase().replaceAll("_", " ")} của lô hàng.`;
  if (name.endsWith("_AIRLINE")) return `Mã hãng hàng không ${readableFieldName(name.replace(/_AIRLINE$/, ""))} của ${object}.`;
  if (name.endsWith("_SECTOR")) return `Mã chặng bay ${readableFieldName(name.replace(/_SECTOR$/, ""))} của ${object}.`;
  if (name.endsWith("_STATION")) return `Mã trạm ${readableFieldName(name.replace(/_STATION$/, ""))} của ${object}.`;
  if (name.endsWith("_FLG")) return `Cờ ${readableFieldName(name.replace(/_FLG$/, ""))} của ${object}.`;
  if (name.endsWith("_SEQ")) return `Số thứ tự ${readableFieldName(name.replace(/_SEQ$/, ""))} của ${object}.`;
  if (name.endsWith("_AMT")) return `Số tiền ${readableFieldName(name.replace(/_AMT$/, ""))} của ${object}.`;
  if (name.endsWith("_MONTH")) return `Tháng ${readableFieldName(name.replace(/_MONTH$/, ""))} của ${object}.`;
  if (name.endsWith("_IDENTIFIER")) return `Mã định danh ${readableFieldName(name.replace(/_IDENTIFIER$/, ""))} của ${object}.`;
  if (name.endsWith("_PROGRAM")) return `Tên chương trình ${readableFieldName(name.replace(/_PROGRAM$/, ""))} của ${object}.`;
  if (name.endsWith("_AGENCY")) return `Mã đại lý hoặc đơn vị ${readableFieldName(name.replace(/_AGENCY$/, ""))} của ${object}.`;
  if (name.endsWith("_KEY")) return `Khóa ${readableFieldName(name.replace(/_KEY$/, ""))} của ${object}.`;
  if (name.endsWith("_RBD")) return `Mã booking designator ${readableFieldName(name.replace(/_RBD$/, ""))} của ${object}.`;
  if (name.endsWith("_REF")) return `Mã tham chiếu ${readableFieldName(name.replace(/_REF$/, ""))} của ${object}.`;
  if (name.endsWith("_DESC")) return `Mô tả ${readableFieldName(name.replace(/_DESC$/, ""))} của ${object}.`;
  if (name.endsWith("_BY")) return `Mã người dùng ${readableFieldName(name.replace(/_BY$/, ""))} của ${object}.`;
  if (name.endsWith("_PERC")) return `Tỷ lệ ${readableFieldName(name.replace(/_PERC$/, ""))} của ${object}.`;
  if (name.endsWith("_SEQUENCE")) return `Số thứ tự ${readableFieldName(name.replace(/_SEQUENCE$/, ""))} của ${object}.`;
  if (name.endsWith("_DIGIT")) return `Chữ số kiểm tra ${readableFieldName(name.replace(/_DIGIT$/, ""))} của ${object}.`;
  if (name.endsWith("_ONLINE")) return `Cờ xác định trạng thái trực tuyến của ${object}.`;
  if (name.endsWith("_CLASS")) return `Hạng ${readableFieldName(name.replace(/_CLASS$/, ""))} của ${object}.`;
  if (name.endsWith("_GSA")) return `Mã đại lý GSA ${readableFieldName(name.replace(/_GSA$/, ""))} của ${object}.`;
  if (name.endsWith("_PREFIX")) return `Mã tiền tố ${readableFieldName(name.replace(/_PREFIX$/, ""))} của ${object}.`;
  if (name.endsWith("_VALUE")) return `Giá trị ${readableFieldName(name.replace(/_VALUE$/, ""))} của ${object}.`;
  if (name.endsWith("_TOTAL")) return `Tổng số ${readableFieldName(name.replace(/_TOTAL$/, ""))} của ${object}.`;
  if (name.endsWith("_CHECK")) return `Kết quả kiểm tra ${readableFieldName(name.replace(/_CHECK$/, ""))} của ${object}.`;
  if (name.endsWith("_PNR")) return `Mã PNR ${readableFieldName(name.replace(/_PNR$/, ""))} của ${object}.`;
  if (name.endsWith("_GEN")) return `Cờ xác định ${readableFieldName(name.replace(/_GEN$/, ""))} do hệ thống tự sinh của ${object}.`;
  if (name.endsWith("_PLACE_OF_ISSUE")) return `Địa điểm phát hành ${readableFieldName(name.replace(/_PLACE_OF_ISSUE$/, ""))} của ${object}.`;
  if (name.endsWith("_UPLIFTED")) return `Giá trị uplifted ${readableFieldName(name.replace(/_UPLIFTED$/, ""))} của ${object}.`;
  if (name.endsWith("_GROUP")) return `Nhóm ${readableFieldName(name.replace(/_GROUP$/, ""))} của ${object}.`;
  if (name.endsWith("_AMT_COL")) return `Số tiền ${readableFieldName(name.replace(/_AMT_COL$/, ""))} của ${object}.`;
  if (name.endsWith("_DESIGNATOR")) return `Mã định danh ${readableFieldName(name.replace(/_DESIGNATOR$/, ""))} của ${object}.`;
  if (name.endsWith("_DIFF")) return `Chênh lệch ${readableFieldName(name.replace(/_DIFF$/, ""))} của ${object}.`;
  if (name.endsWith("_DETAILS")) return `Chi tiết ${readableFieldName(name.replace(/_DETAILS$/, ""))} của ${object}.`;
  if (name.endsWith("_CHANNEL")) return `Kênh ${readableFieldName(name.replace(/_CHANNEL$/, ""))} của ${object}.`;
  if (name.endsWith("_ARCHIVED")) return `Cờ xác định trạng thái lưu trữ của ${object}.`;
  if (name.endsWith("_DONE")) return `Cờ xác định ${readableFieldName(name.replace(/_DONE$/, ""))} đã hoàn tất của ${object}.`;
  if (name.endsWith("_PERCENT")) return `Tỷ lệ ${readableFieldName(name.replace(/_PERCENT$/, ""))} của ${object}.`;
  const numberedAttribute = name.match(/^(.+)_ATTRIB(\d+)$/);
  if (numberedAttribute) return `Thuộc tính ${readableFieldName(numberedAttribute[1])} thứ ${numberedAttribute[2]} của ${object}.`;
  const numberedAttributeLong = name.match(/^(.+)_ATTRIBUTE(\d+)$/);
  if (numberedAttributeLong) return `Thuộc tính ${readableFieldName(numberedAttributeLong[1])} thứ ${numberedAttributeLong[2]} của ${object}.`;
  const divergentCoupon = name.match(/^DIVERGENT_CPN_(\d+)$/);
  if (divergentCoupon) return `Coupon divergent thứ ${divergentCoupon[1]} của ${object}.`;
  const publishedTaxCurrency = name.match(/^PUB_TAX_CURRENCY_(\d+)$/);
  if (publishedTaxCurrency) return `Mã tiền tệ công bố cho khoản thuế thứ ${publishedTaxCurrency[1]}.`;
  const deferredUpliftCoupon = name.match(/^DE_AI_FC_([FCYU])_CPNS$/);
  if (deferredUpliftCoupon) return `Số coupon hạng ${deferredUpliftCoupon[1]} thuộc nhóm DE_AI_FC của ${object}.`;
  if (name.endsWith("_LOCKED")) return `Cờ xác định trạng thái khóa của ${object}.`;
  if (name.endsWith("_REVENUE")) return `Doanh thu ${readableFieldName(name.replace(/_REVENUE$/, ""))} của ${object}.`;
  if (name.endsWith("_SERIAL")) return `Số serial ${readableFieldName(name.replace(/_SERIAL$/, ""))} của ${object}.`;
  if (name.endsWith("_MILEAGE")) return `Khoảng cách ${readableFieldName(name.replace(/_MILEAGE$/, ""))} của ${object}.`;
  if (name.endsWith("_REQD")) return `Cờ xác định yêu cầu ${readableFieldName(name.replace(/_REQD$/, ""))} của ${object}.`;
  if (name.endsWith("_PROCESSED")) return `Thời điểm hoặc kỳ xử lý ${readableFieldName(name.replace(/_PROCESSED$/, ""))} của ${object}.`;
  if (name.endsWith("_PENALTY")) return `Mức phạt ${readableFieldName(name.replace(/_PENALTY$/, ""))} của ${object}.`;
  if (name.endsWith("_AREA")) return `Khu vực ${readableFieldName(name.replace(/_AREA$/, ""))} của ${object}.`;
  if (name.endsWith("_STAGE")) return `Giai đoạn ${readableFieldName(name.replace(/_STAGE$/, ""))} của ${object}.`;
  if (name.endsWith("_STRING")) return `Chuỗi ${readableFieldName(name.replace(/_STRING$/, ""))} của ${object}.`;
  if (name.endsWith("_DATE_OF_ISSUE")) return `Ngày phát hành ${readableFieldName(name.replace(/_DATE_OF_ISSUE$/, ""))} của ${object}.`;
  if (name.endsWith("_COUPONS")) return `Số lượng coupon ${readableFieldName(name.replace(/_COUPONS$/, ""))} của ${object}.`;
  if (name.endsWith("_CPN")) return `Coupon ${readableFieldName(name.replace(/_CPN$/, ""))} của ${object}.`;
  if (name.endsWith("_APPL")) return `Cờ xác định áp dụng ${readableFieldName(name.replace(/_APPL$/, ""))} của ${object}.`;
  const upliftCoupon = name.match(/^AI_FC_([FCYU])_CPNS$/);
  if (upliftCoupon) return `Số coupon hạng ${upliftCoupon[1]} thuộc nhóm AI_FC của ${object}.`;
  const frAttribute = name.match(/^FR_ATTRIBUTE_(\d+)$/);
  if (frAttribute) return `Thuộc tính FR thứ ${frAttribute[1]} của ${object}.`;
  const numberedId = name.match(/^(.+)_ID_(\d+)$/);
  if (numberedId) return `Mã định danh ${readableFieldName(numberedId[1])} thứ ${numberedId[2]} của ${object}.`;
  if (name.endsWith("_TAX")) return `Khoản thuế ${readableFieldName(name.replace(/_TAX$/, ""))} của ${object}.`;
  if (name.endsWith("_COUNT")) return `Số lượng ${readableFieldName(name.replace(/_COUNT$/, ""))} của ${object}.`;
  if (name.endsWith("_FROM")) return `Giá trị bắt đầu ${readableFieldName(name.replace(/_FROM$/, ""))} của ${object}.`;
  if (name.endsWith("_TO")) return `Giá trị kết thúc ${readableFieldName(name.replace(/_TO$/, ""))} của ${object}.`;
  if (name.endsWith("_CURRENCY") || name.endsWith("_CCY") || name.includes("CURRENCY_CODE")) return `Mã tiền tệ áp dụng cho ${object}.`;
  if (name.endsWith("_IND") || name.endsWith("_INDICATOR") || name.endsWith("_FLAG")) {
    const booleanSample = sampleValues.length > 0 && sampleValues.every((value) => /^(Y|N)$/i.test(value));
    return `${booleanSample ? "Cờ" : "Chỉ báo"} ${name.replace(/_(IND|INDICATOR|FLAG)$/, "").toLowerCase().replaceAll("_", " ")} của ${object}.`;
  }
  if (name.includes("WEIGHT")) return `Khối lượng của ${object}.`;
  if (name.includes("AMOUNT") || name.includes("CHG") || name.includes("CHARGE")) return `Số tiền cước hoặc phí của ${object}.`;
  if (name.endsWith("_RATE") || name.includes("RATE_")) return `Tỷ lệ áp dụng cho ${object}.`;
  if (name.endsWith("_DATE") || name.endsWith("_TIME") || name.includes("_TIMESTMP")) return `Ngày hoặc thời điểm ${readableFieldName(name.replace(/_(DATE|TIME|TIMESTMP)$/, ""))} của ${object}.`;
  if (name.endsWith("_STATUS") || name.endsWith("_STA")) return `Trạng thái xử lý của ${object}.`;
  if (name.endsWith("_TYPE")) return `Loại ${readableFieldName(name.replace(/_TYPE$/, "")) || "bản ghi"} của ${object}.`;
  if (name.endsWith("_ID")) return `Mã định danh ${readableFieldName(name.replace(/_ID$/, "")) || "bản ghi"} của ${object}.`;
  if (name.endsWith("_CODE") || name.endsWith("_CDE")) return `Mã ${readableFieldName(name.replace(/_(CODE|CDE)$/, "")) || "nghiệp vụ"} của ${object}.`;
  if (name.endsWith("_NUMBER") || name.endsWith("_NUMB") || name.endsWith("_NO")) return `Số ${readableFieldName(name.replace(/_(NUMBER|NUMB|NO)$/, "")) || "nghiệp vụ"} của ${object}.`;
  if (name === "CODE") return `Mã nghiệp vụ của ${object}.`;
  if (name === "NAME") return `Tên hiển thị của ${object}.`;
  if (name === "REMARKS" || name.includes("DESCRIPTION") || name.includes("NOTE")) return `Nội dung mô tả hoặc ghi chú của ${object}.`;
  return semanticDescriptionFallback(column, table);
}

// Cột Mô tả dùng cho nội dung data element; loại tiền tố chương/mục để thông tin nguồn không lẫn vào mô tả.
function cleanDescription(value) {
  return String(value ?? "")
    .replace(/^SSIM\s+Chương\s+[^:]+:\s*/i, "")
    .replace(
      /^Trường quản lý nguồn trong schema;\s*tài liệu SSIM Chương \d+ .*? không định nghĩa data element này\.$/i,
      "Trường quản lý nguồn trong schema; không có mô tả data element tương ứng.",
    )
    .trim();
}

function isDescriptionPlaceholder(value) {
  const normalized = String(value ?? "").trim().toLocaleLowerCase("vi-VN");
  return normalized === ""
    || normalized === "chưa rõ"
    || normalized === "không có"
    || normalized === UNRESOLVED_SEMANTIC_DESCRIPTION.toLocaleLowerCase("vi-VN")
    || normalized.includes("không có mô tả data element")
    || normalized.includes("thông tin nghiệp vụ của đối tượng dữ liệu")
    || normalized.includes("vai trò chi tiết cần được xác nhận")
    || normalized.includes("dùng để lưu giá trị của");
}

function semanticDescriptionWithRetry(column, table, sampleValues, semanticErrors) {
  for (let attempt = 1; attempt <= MAX_SEMANTIC_DESCRIPTION_ATTEMPTS; attempt += 1) {
    try {
      const description = semanticDescriptionForColumn(column, table, sampleValues);
      if (!isDescriptionPlaceholder(description)) return description;
    } catch (error) {
      // Resolver có thể không đủ bằng chứng cho một field; tiếp tục thử trong giới hạn để không dừng cả workbook.
    }
  }

  const fieldKey = `${table.schema}.${table.name}.${column.name}`;
  semanticErrors.push(
    `${fieldKey}: Không tạo được mô tả semantic sau ${MAX_SEMANTIC_DESCRIPTION_ATTEMPTS} lần thử; đã ghi "${UNRESOLVED_SEMANTIC_DESCRIPTION}"`,
  );
  return UNRESOLVED_SEMANTIC_DESCRIPTION;
}

function getFieldValues(column, table, descriptionRows, sampleRows, semanticErrors = []) {
  const description = csvValue(descriptionRows, table, column.name, ["description", "mô tả", "desc"]);
  const sample = csvValue(descriptionRows, table, column.name, ["sample", "data_sample", "dữ liệu mẫu"]);
  const sampleValues = sampleValuesForColumn(column.name, sampleRows);
  const defaultFromSource = csvValue(descriptionRows, table, column.name, ["default", "giá trị mặc định"]);
  const piiSource = csvValue(descriptionRows, table, column.name, ["pii"]);
  const piiType = csvValue(descriptionRows, table, column.name, ["pii_type", "loại pii"]);
  const note = csvValue(descriptionRows, table, column.name, ["notes", "note", "ghi chú"]);
  const documentDescription = documentDescriptionForColumn(table, column.name);
  const cleanedDescription = cleanDescription(description || documentDescription);
  const directDescription = isDescriptionPlaceholder(cleanedDescription) ? "" : cleanedDescription;
  const inferredDescription = directDescription ? "" : semanticDescriptionWithRetry(column, table, sampleValues, semanticErrors);
  const effectiveDescription = directDescription || inferredDescription;
  const notes = note ? [note] : [];
  if (!sample && sampleValues.length === 0) notes.push("Chưa có dữ liệu");
  if (/\b(CLOB|BLOB|JSON|XML)\b/i.test(column.oracle26Type ?? column.type)) notes.push("Cần giữ nguyên payload " + (column.oracle26Type ?? column.type));

  const piiConfirmed = piiSource.toUpperCase() === "Y";
  const classification = piiConfirmed ? piiType || "Chưa rõ" : piiSource.toUpperCase() === "N" ? "N/A" : "Chưa rõ";
  return [
    column.name,
    bronzeColumnName(column.name),
    column.type,
    column.oracle26Type ?? column.type,
    effectiveDescription,
    defaultFromSource || column.defaultValue || "Chưa rõ",
    sample || sampleValues.slice(0, 3).join(" | ") || "Chưa rõ",
    "Chưa rõ",
    "N/A",
    "Chưa rõ",
    "Chưa rõ",
    "Chưa rõ",
    "Chưa rõ",
    column.allowNull || "Chưa rõ",
    column.isUnique ? "Y" : "Chưa rõ",
    "Chưa rõ",
    "Chưa rõ",
    "Chưa rõ",
    "Chưa rõ",
    "N/A",
    "N/A",
    "ENC-L0",
    "Chưa rõ",
    classification,
    "N/A",
    "N/A",
    column.oracle26TypeNote || "",
    "Chưa xác nhận",
    notes.join("; "),
  ];
}

function applyCurrentSourceRowStyle(sheet, firstRow, lastRow) {
  if (lastRow < firstRow) return;
  // Dòng kỹ thuật có style vàng riêng; khi bị dùng làm dòng field phải trả về style field để người đọc không nhầm với metadata kỹ thuật.
  sheet.getRange(`A${firstRow}:A${lastRow}`).format = {
    fill: "#E8F4F8",
    font: { name: "Calibri", size: 11, bold: true, color: "#0B3D5C" },
    borders: { preset: "all", style: "thin", color: "#C5D0D6" },
    wrapText: true,
    verticalAlignment: "top",
  };
  sheet.getRange(`B${firstRow}:AD${lastRow}`).format = {
    fill: "#F4FBF6",
    font: { name: "Calibri", size: 11, color: "#000000" },
    borders: { preset: "all", style: "thin", color: "#C5D0D6" },
    wrapText: true,
    verticalAlignment: "top",
  };
  for (let rowNumber = firstRow + 1; rowNumber <= lastRow; rowNumber += 2) {
    sheet.getRange(`B${rowNumber}:AD${rowNumber}`).format.fill = "#EAF6EE";
  }
  sheet.getRange(`C${firstRow}:C${lastRow}`).format.fill = "#E3F2E9";
  sheet.getRange(`E${firstRow}:E${lastRow}`).format.fill = "#E3F2E9";
  sheet.getRange(`AB${firstRow}:AD${lastRow}`).format = {
    fill: "#FFF8E7",
    font: { name: "Calibri", size: 11, color: "#000000" },
    borders: { preset: "all", style: "thin", color: "#C5D0D6" },
    wrapText: true,
    verticalAlignment: "top",
  };
}

function applyCurrentTechnicalRowStyle(sheet, firstRow, lastRow) {
  if (lastRow < firstRow) return;
  // Màu vàng chỉ dành cho metadata kỹ thuật Bronze; áp riêng sau sourceLastRow để không lan ngược vào field nghiệp vụ.
  sheet.getRange(`A${firstRow}:AD${lastRow}`).format = {
    fill: "#FFF3CD",
    font: { name: "Calibri", size: 11, color: "#000000" },
    borders: { preset: "all", style: "thin", color: "#C5D0D6" },
    wrapText: true,
    verticalAlignment: "top",
  };
}

function setSheetCell(sheet, address, value) {
  sheet.getRange(address).values = [[value]];
}

function fillBronzeWorkbookSheets(workbook, table, args) {
  // Template mới tách metadata bảng, CDC/SCD và LOAD thành ba sheet; ghi mặc định chưa rõ để không biến thiếu bằng chứng thành quyết định nghiệp vụ.
  const bronzeName = bronzeTableName(table, args);
  const meta = workbook.worksheets.getItem("00-META");
  const metaValues = {
    B5: args.system || "Chưa rõ",
    B6: args.database || "Chưa rõ",
    B7: table.schema || "Chưa rõ",
    B8: table.name,
    B9: bronzeName,
    B10: new Date().toISOString().slice(0, 10),
    B11: args.designer || "Chưa rõ",
    B12: table.objectType || "table",
    B13: "Chưa rõ",
    B14: args.functionGroup || "Chưa rõ",
    B15: args.overviewFile || "Chưa rõ",
    B16: "Chưa rõ",
    B17: "Chưa rõ",
    B18: "Chưa rõ",
    B19: table.primaryKeys.size > 0 ? [...table.primaryKeys].join(", ") : "Chưa rõ",
    B20: "Chưa rõ",
    B21: table.uniqueConstraints.length > 0 ? table.uniqueConstraints.map((columns) => columns.join(", ")).join("; ") : "Chưa rõ",
    B22: "Chưa rõ",
    B23: "Chưa rõ",
    B24: "Chưa rõ",
    B25: "Chưa rõ",
    B26: "Chưa rõ",
  };
  Object.entries(metaValues).forEach(([address, value]) => setSheetCell(meta, address, value));

  const cdc = workbook.worksheets.getItem("02-CDC");
  [7, 8, 9, 10, 11, 12, 13, 14, 18, 19, 20, 21].forEach((rowNumber) => setSheetCell(cdc, `B${rowNumber}`, "Chưa rõ"));

  const load = workbook.worksheets.getItem("03-LOAD");
  const loadRows = {
    6: ["Chưa rõ", "Chưa rõ", "Đề xuất"],
    7: [table.primaryKeys.size > 0 ? [...table.primaryKeys].join(", ") : "Chưa rõ", table.primaryKeys.size > 0 ? "DDL PRIMARY KEY" : "Chưa rõ", "Đề xuất"],
    8: ["Chưa rõ", "Chưa rõ", "Mở"],
    9: ["Chưa rõ", "Chưa rõ", "Mở"],
    10: ["Chưa rõ", "Chưa rõ", "Đề xuất"],
    11: ["Chưa rõ", "Chưa rõ", "Đề xuất"],
  };
  Object.entries(loadRows).forEach(([rowNumber, values]) => {
    ["B", "C", "D"].forEach((column, index) => setSheetCell(load, `${column}${rowNumber}`, values[index]));
  });
}

async function createCurrentWorkbook(workbook, outputPath, table, descriptionRows, sampleRows, inspectOutputDir, args, semanticErrors = []) {
  fillBronzeWorkbookSheets(workbook, table, args);
  const sheet = workbook.worksheets.getItem(TEMPLATE_SHEET);
  const sourceRowCount = table.columns.length;
  const totalRowCount = sourceRowCount + BRONZE_TECHNICAL_ROW_COUNT;
  const sourceLastRow = FIRST_DATA_ROW + sourceRowCount - 1;
  const lastRow = FIRST_DATA_ROW + totalRowCount - 1;
  const templateLastRow = TEMPLATE_LAST_ROW;
  const extendedSourceFirstRow = TECHNICAL_TEMPLATE_FIRST_ROW;
  const normalTemplateRow = sheet.getRange(`A${TECHNICAL_TEMPLATE_FIRST_ROW - 1}:AD${TECHNICAL_TEMPLATE_FIRST_ROW - 1}`);
  const technicalTemplateValues = sheet.getRange(`A${TECHNICAL_TEMPLATE_FIRST_ROW}:AD${templateLastRow}`).values;
  const values = table.columns.map((column, index) => [index + 1, ...getFieldValues(column, table, descriptionRows, sampleRows, semanticErrors)]);

  // Xóa data sample của template nhưng giữ nguyên vùng ghi chú phía dưới nếu workbook nguồn có ít field.
  sheet.getRange(`A${FIRST_DATA_ROW}:AD${Math.max(lastRow, templateLastRow)}`).clear({ applyTo: "contents" });

  if (sourceRowCount > 0) {
    if (sourceLastRow >= TECHNICAL_TEMPLATE_FIRST_ROW) {
      for (let rowNumber = TECHNICAL_TEMPLATE_FIRST_ROW; rowNumber <= sourceLastRow; rowNumber += 1) {
        normalTemplateRow.copyTo(sheet.getRange(`A${rowNumber}:AD${rowNumber}`), "all");
      }
    }
    sheet.getRange(`A${FIRST_DATA_ROW}:AD${sourceLastRow}`).values = values;
    if (sourceLastRow >= extendedSourceFirstRow) {
      applyCurrentSourceRowStyle(sheet, extendedSourceFirstRow, sourceLastRow);
    }
  }

  for (let index = 0; index < BRONZE_TECHNICAL_ROW_COUNT; index += 1) {
    const rowNumber = sourceLastRow + 1 + index;
    const templateRowNumber = TECHNICAL_TEMPLATE_FIRST_ROW + index;
    sheet.getRange(`A${templateRowNumber}:AD${templateRowNumber}`).copyTo(sheet.getRange(`A${rowNumber}:AD${rowNumber}`), "all");
    const technicalValues = [...technicalTemplateValues[index]];
    sheet.getRange(`A${rowNumber}:AD${rowNumber}`).values = [technicalValues];
  }
  applyCurrentTechnicalRowStyle(sheet, sourceLastRow + 1, lastRow);

  // Ghi chú có thể dài hơn nội dung mẫu nên cần tự căn chiều cao để không làm mất phần diễn giải hoặc cảnh báo dữ liệu.
  sheet.getRange(`A${FIRST_DATA_ROW}:AD${lastRow}`).format.autofitRows();
  workbook.recalculate();
  const { SpreadsheetFile } = await loadArtifactTool();
  const output = await SpreadsheetFile.exportXlsx(workbook);
  await output.save(outputPath);
  const inspectPath = `${outputPath}.inspect.ndjson`;
  if (await exists(inspectPath)) {
    // Artifact Tool tạo sidecar QA cạnh workbook, nên chuyển sang thư mục riêng để thư mục deliverable chỉ chứa file bàn giao.
    await fs.rename(inspectPath, path.join(inspectOutputDir, path.basename(inspectPath)));
  }
  return totalRowCount;
}

async function createWorkbook(templatePath, outputPath, table, descriptionRows, sampleRows, inspectOutputDir, args, semanticErrors = []) {
  const { FileBlob, SpreadsheetFile } = await loadArtifactTool();
  const input = await FileBlob.load(templatePath);
  const workbook = await SpreadsheetFile.importXlsx(input);
  await validateTemplateStructure(workbook);
  return createCurrentWorkbook(workbook, outputPath, table, descriptionRows, sampleRows, inspectOutputDir, args, semanticErrors);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await fs.mkdir(args.outputDir, { recursive: true });
  const fileReview = await reviewInputFiles(args);
  await writeFileReviewCheckpoint(args.outputDir, fileReview);
  if (!fileReview.allReviewed) {
    const unreadable = fileReview.unreadable.map((item) => `${item.filePath}: ${item.error}`).join("; ");
    throw new Error(`FILE REVIEW CHECKPOINT = NO. Không được tạo workbook khi còn file chưa đọc được: ${unreadable}`);
  }

  const ddlTables = [];
  for (const ddlPath of args.ddl) {
    const sql = await fs.readFile(ddlPath, "utf8");
    ddlTables.push(...parseCreateTables(sql, ddlPath), ...parseCreateViews(sql, ddlPath));
  }

  const requested = args.all
    ? ddlTables
    : args.objects.map((value) => {
        const [schema, ...nameParts] = value.split(".");
        return { schema, name: nameParts.join(".") };
      });
  const uniqueTargets = new Map(requested.map((target) => [objectKey(target.schema, target.name), target]));
  const targets = [...uniqueTargets.values()].sort((left, right) => objectKey(left.schema, left.name).localeCompare(objectKey(right.schema, right.name)));
  const descriptionRows = args.descriptionCsv ? parseCsv(await fs.readFile(args.descriptionCsv, "utf8")) : [];
  const sampleData = await loadSampleData(args.sampleData);
  const inspectOutputDir = path.join(args.outputDir, "inspect");
  await fs.mkdir(inspectOutputDir, { recursive: true });

  const report = [["Source DDL", "Data source", "DB", "Schema", "Object name", "Bronze table", "Output file", "Status", "Source columns", "Bronze technical columns", "Conflicts", "OQs", "Errors"]];
  for (const target of targets) {
    const key = objectKey(target.schema, target.name);
    const table = ddlTables.find((candidate) => objectKey(candidate.schema, candidate.name) === key);
    const targetForName = table || { ...target, name: target.name, objectType: "table" };
    const outputBronzeName = bronzeTableName(targetForName, args);
    const outputName = `survey-05-phan-tich-du-lieu-03-${safeFilePart(outputBronzeName)}.xlsx`;
    const outputPath = path.join(args.outputDir, outputName);
    if (await exists(outputPath)) {
      report.push([table?.sourceFile ?? "", args.dataSource, args.database, target.schema, target.name, outputBronzeName, outputPath, "skipped", 0, BRONZE_TECHNICAL_ROW_COUNT, "", "Output đã tồn tại", ""]);
      continue;
    }
    if (!table) {
      report.push(["", args.dataSource, args.database, target.schema, target.name, outputBronzeName, outputPath, "conflict", 0, 0, "Không tìm thấy CREATE TABLE/VIEW khớp", "Kiểm tra schema và tên object", ""]);
      continue;
    }
    if (table.parseError) {
      report.push([table.sourceFile, args.dataSource, args.database, table.schema, table.name, outputBronzeName, outputPath, "conflict", 0, 0, table.parseError, "Cần data dictionary hoặc danh sách cột view", ""]);
      continue;
    }
    try {
      const datatypeConflicts = prepareOracle26Datatypes(table, args);
      const sampleRows = sampleRowsForTable(sampleData, table, targets.length);
      const semanticErrors = [];
      await createWorkbook(args.template, outputPath, table, descriptionRows, sampleRows, inspectOutputDir, args, semanticErrors);
      report.push([
        table.sourceFile,
        args.dataSource,
        args.database,
        table.schema,
        table.name,
        outputBronzeName,
        outputPath,
        "created",
        table.columns.length,
        BRONZE_TECHNICAL_ROW_COUNT,
        datatypeConflicts.join(" | "),
        datatypeConflicts.length > 0 ? "Đã tạo workbook; xem Conflicts/OQs trong batch-report.md để xác nhận datatype" : "",
        semanticErrors.join(" | "),
      ]);
    } catch (error) {
      report.push([table.sourceFile, args.dataSource, args.database, table.schema, table.name, outputBronzeName, outputPath, "error", 0, 0, "", "", error instanceof Error ? error.message : String(error)]);
    }
  }
  const reportText = markdownReport(report);
  await fs.writeFile(path.join(args.outputDir, "batch-report.md"), reportText, "utf8");
  console.log(reportText);
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
