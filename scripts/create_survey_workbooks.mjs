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
  path.join(SKILL_DIR, "references/logic-pii.md"),
  path.join(SKILL_DIR, "references/Quy tắc bảo vệ Airline PII - Masking & Encryption.md"),
];
const DEFAULT_OUTPUT_DIR = path.join(SKILL_DIR, "outputs");
const TEMPLATE_SHEET = "03-COLUMNS";
const FIRST_DATA_ROW = 7;
const TEMPLATE_DATA_ROWS = 80;

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
    [--output-dir <directory>] [--all]

Options:
  --template          Survey 05 template workbook. Default: bundled assets/ template.
  --ddl               DDL file. Repeat for multiple files. Default: bundled sources/ DDLs.
  --object            Exact SCHEMA.TABLE target. Repeat for multiple targets.
  --description-csv   Optional CSV with description/sample columns.
  --sample-data       Optional masked sample data in CSV or JSON format. Repeat for multiple files.
  --reference         Additional reference file that belongs to the input scope. Repeat as needed.
  --input-dir         Directory whose accessible files must be reviewed before analysis.
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
    }
    results.push(table);
    header.lastIndex = closingIndex + 1;
  }
  return results;
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

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
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

function tableBusinessObject(table) {
  const name = normalizeIdentifier(table.name);
  if (name === "T_AIR_WAYBILL") return "vận đơn hàng không";
  if (name.includes("CARGO_SPOT_AWB_LOAD")) return "vận đơn hàng không";
  if (name.includes("AWB_PRICING")) return "dòng tính cước của vận đơn";
  if (name.includes("AWB_CHARGE")) return "dòng phụ phí của vận đơn";
  if (name.includes("AIR_WAYBILL_ITEM")) return "mặt hàng trên vận đơn";
  if (name.includes("INVOICE")) return "chứng từ hóa đơn";
  return "đối tượng dữ liệu của bảng";
}

function indexedSuffix(columnName) {
  const match = normalizeIdentifier(columnName).match(/_(\d+)$/);
  return match ? Number(match[1]) : null;
}

function semanticDescriptionForColumn(column, table, sampleValues) {
  const name = normalizeIdentifier(column.name);
  const object = tableBusinessObject(table);
  const tableName = normalizeIdentifier(table.name);
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
  if (name.endsWith("_CURRENCY") || name.endsWith("_CCY") || name.includes("CURRENCY_CODE")) return `Mã tiền tệ áp dụng cho ${object}.`;
  if (name.endsWith("_IND") || name.endsWith("_INDICATOR") || name.endsWith("_FLAG")) {
    const booleanSample = sampleValues.length > 0 && sampleValues.every((value) => /^(Y|N)$/i.test(value));
    return `${booleanSample ? "Cờ" : "Chỉ báo"} ${name.replace(/_(IND|INDICATOR|FLAG)$/, "").toLowerCase().replaceAll("_", " ")} của ${object}.`;
  }
  if (name.includes("WEIGHT")) return `Khối lượng liên quan đến ${object}, dùng theo ngữ cảnh của trường.`;
  if (name.includes("AMOUNT") || name.includes("CHG") || name.includes("CHARGE")) return `Số tiền cước hoặc phí liên quan đến ${object}.`;
  if (name.endsWith("_RATE") || name.includes("RATE_")) return `Tỷ lệ áp dụng cho ${object}.`;
  if (name.endsWith("_DATE") || name.endsWith("_TIME") || name.includes("_TIMESTMP")) return `Ngày hoặc thời điểm ${name.replace(/_(DATE|TIME|TIMESTMP)$/, "").toLowerCase().replaceAll("_", " ")} của ${object}.`;
  if (name.endsWith("_STATUS") || name.endsWith("_STA")) return `Trạng thái xử lý của ${object}.`;
  if (name.endsWith("_TYPE")) return `Loại nghiệp vụ áp dụng cho ${object}.`;
  if (name.endsWith("_CODE") || name.endsWith("_CDE")) return `Mã nghiệp vụ liên quan đến ${object}.`;
  if (name.endsWith("_NUMBER") || name.endsWith("_NUMB") || name.endsWith("_NO")) return `Số hoặc mã định danh liên quan đến ${object}.`;
  if (name === "REMARKS" || name.includes("DESCRIPTION") || name.includes("NOTE")) return `Nội dung mô tả hoặc ghi chú liên quan đến ${object}.`;
  return "";
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

function getFieldValues(column, table, descriptionRows, sampleRows) {
  const description = csvValue(descriptionRows, table, column.name, ["description", "mô tả", "desc"]);
  const sample = csvValue(descriptionRows, table, column.name, ["sample", "data_sample", "dữ liệu mẫu"]);
  const sampleValues = sampleValuesForColumn(column.name, sampleRows);
  const defaultFromSource = csvValue(descriptionRows, table, column.name, ["default", "giá trị mặc định"]);
  const piiSource = csvValue(descriptionRows, table, column.name, ["pii"]);
  const piiType = csvValue(descriptionRows, table, column.name, ["pii_type", "loại pii"]);
  const protection = csvValue(descriptionRows, table, column.name, ["masking", "encryption", "logic masking/encrypt pii"]);
  const note = csvValue(descriptionRows, table, column.name, ["notes", "note", "ghi chú"]);
  const documentDescription = documentDescriptionForColumn(table, column.name);
  const directDescription = cleanDescription(description || documentDescription);
  const inferredDescription = directDescription ? "" : semanticDescriptionForColumn(column, table, sampleValues);
  const effectiveDescription = directDescription || inferredDescription;
  const notes = note ? [note] : [];
  if (!sample && sampleValues.length === 0) notes.push("Chưa có dữ liệu");
  if (/\b(CLOB|BLOB|JSON|XML)\b/i.test(column.type)) notes.push("Cần giữ nguyên payload " + column.type);

  const pii = piiSource.toUpperCase() === "Y" ? "Y" : "N";
  const logic = pii === "Y" ? protection || "Cần làm rõ" : "Không áp dụng";
  const type = pii === "Y" ? piiType : "";
  return [
    column.name,
    column.type,
    column.allowNull,
    column.isPrimaryKey && column.foreignKey ? "PK+FK" : column.isPrimaryKey ? "PK" : column.foreignKey ? "FK" : "",
    column.foreignKey || "Không có",
    effectiveDescription || "Chưa rõ",
    defaultFromSource || column.defaultValue || "Không có",
    sample || sampleValues.slice(0, 3).join(" | ") || "Không có",
    pii,
    type,
    logic,
    null,
    null,
    "Chưa xác nhận",
    notes.join("; "),
  ];
}

function applyExtraRowValidation(sheet, firstRow, lastRow) {
  if (lastRow <= FIRST_DATA_ROW + TEMPLATE_DATA_ROWS - 1) return;
  const range = (column) => `${column}${firstRow}:${column}${lastRow}`;
  sheet.getRange(range("D")).dataValidation = { rule: { type: "list", values: ["Y", "N"] } };
  sheet.getRange(range("E")).dataValidation = { rule: { type: "list", values: ["PK", "FK", "PK+FK"] } };
  sheet.getRange(range("J")).dataValidation = { rule: { type: "list", values: ["Y", "N", "Chưa rõ"] } };
  sheet.getRange(range("M")).dataValidation = { rule: { type: "list", values: ["Y", "N"] } };
  sheet.getRange(range("O")).dataValidation = { rule: { type: "list", values: ["Chưa xác nhận", "Đã xác nhận", "Cần làm rõ"] } };
  sheet.getRange(range("K")).dataValidation = { rule: { type: "list", formula1: "'05-LOAI-PII'!$B$6:$B$20" } };
}

function applyExtraRowStyle(sheet, firstRow, lastRow) {
  if (lastRow < firstRow) return;
  // Dòng ngoài vùng template không nhận style ổn định từ copyTo nên phải khai báo lại đúng style của dòng mẫu.
  sheet.getRange(`A${firstRow}:A${lastRow}`).format = {
    fill: "#F4F7FB",
    font: { name: "Calibri", size: 10, bold: true, color: "#2E5A88" },
    borders: { preset: "all", style: "thin", color: "#C5CDD6" },
    wrapText: true,
    horizontalAlignment: "center",
  };
  sheet.getRange(`B${firstRow}:P${lastRow}`).format = {
    fill: "#FFF8DC",
    font: { name: "Calibri", size: 10, color: "#333333" },
    borders: { preset: "all", style: "thin", color: "#C5CDD6" },
    wrapText: true,
    horizontalAlignment: "left",
  };
}

async function createWorkbook(templatePath, outputPath, table, descriptionRows, sampleRows, inspectOutputDir) {
  const { FileBlob, SpreadsheetFile } = await loadArtifactTool();
  const input = await FileBlob.load(templatePath);
  const workbook = await SpreadsheetFile.importXlsx(input);
  const sheet = workbook.worksheets.getItem(TEMPLATE_SHEET);
  const rowCount = table.columns.length;
  const lastRow = FIRST_DATA_ROW + rowCount - 1;
  const templateLastRow = FIRST_DATA_ROW + TEMPLATE_DATA_ROWS - 1;
  const values = table.columns.map((column, index) => [index + 1, ...getFieldValues(column, table, descriptionRows, sampleRows)]);
  const templateRowCount = Math.min(rowCount, TEMPLATE_DATA_ROWS);

  sheet.getRange(`A${FIRST_DATA_ROW}:P${FIRST_DATA_ROW + templateRowCount - 1}`).values = values.slice(0, templateRowCount);
  if (lastRow < templateLastRow) {
    // Các dòng còn lại của template chỉ là dữ liệu minh họa, nên phải xóa nội dung để số field phản ánh đúng DDL.
    sheet.getRange(`A${lastRow + 1}:P${templateLastRow}`).clear({ applyTo: "contents" });
  }
  if (lastRow > templateLastRow) {
    const extraRows = lastRow - templateLastRow;
    const sourceRow = sheet.getRange(`A${templateLastRow}:P${templateLastRow}`);
    for (let index = 0; index < extraRows; index += 1) {
      const rowNumber = templateLastRow + 1 + index;
      // Phải copy sau block values để artifact export không tái tạo dòng mở rộng mà bỏ style của template.
      sourceRow.copyTo(sheet.getRange(`A${rowNumber}:P${rowNumber}`), "all");
      sheet.getRange(`A${rowNumber}:P${rowNumber}`).values = [values[TEMPLATE_DATA_ROWS + index]];
    }
    applyExtraRowStyle(sheet, templateLastRow + 1, lastRow);
    applyExtraRowValidation(sheet, templateLastRow + 1, lastRow);
  }

  // Ghi chú có thể dài hơn nội dung mẫu nên cần tự căn chiều cao để không làm mất phần diễn giải hoặc cảnh báo dữ liệu.
  sheet.getRange(`A${FIRST_DATA_ROW}:P${lastRow}`).format.autofitRows();
  workbook.recalculate();
  const output = await SpreadsheetFile.exportXlsx(workbook);
  await output.save(outputPath);
  const inspectPath = `${outputPath}.inspect.ndjson`;
  if (await exists(inspectPath)) {
    // Artifact Tool tạo sidecar QA cạnh workbook, nên chuyển sang thư mục riêng để thư mục deliverable chỉ chứa file bàn giao.
    await fs.rename(inspectPath, path.join(inspectOutputDir, path.basename(inspectPath)));
  }
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
    ddlTables.push(...parseCreateTables(sql, ddlPath));
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

  const report = [["Source DDL", "Schema", "Object name", "Output file", "Status", "Rows created", "Conflicts", "Questions", "Errors"]];
  for (const target of targets) {
    const key = objectKey(target.schema, target.name);
    const table = ddlTables.find((candidate) => objectKey(candidate.schema, candidate.name) === key);
    const schemaPart = target.schema ? `${safeFilePart(target.schema)}.` : "";
    const outputName = `survey-05-phan-tich-du-lieu-03-${schemaPart}${safeFilePart(target.name)}.xlsx`;
    const outputPath = path.join(args.outputDir, outputName);
    if (await exists(outputPath)) {
      report.push([table?.sourceFile ?? "", target.schema, target.name, outputPath, "skipped", 0, "", "Output đã tồn tại", ""]);
      continue;
    }
    if (!table) {
      report.push(["", target.schema, target.name, outputPath, "conflict", 0, "Không tìm thấy CREATE TABLE khớp", "Kiểm tra schema và tên bảng", ""]);
      continue;
    }
    try {
      const sampleRows = sampleRowsForTable(sampleData, table, targets.length);
      await createWorkbook(args.template, outputPath, table, descriptionRows, sampleRows, inspectOutputDir);
      report.push([table.sourceFile, table.schema, table.name, outputPath, "created", table.columns.length, "", "", ""]);
    } catch (error) {
      report.push([table.sourceFile, table.schema, table.name, outputPath, "error", 0, "", "", error instanceof Error ? error.message : String(error)]);
    }
  }
  const reportText = report.map((row) => row.map(csvEscape).join(",")).join("\n") + "\n";
  await fs.writeFile(path.join(args.outputDir, "batch-report.csv"), reportText, "utf8");
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
