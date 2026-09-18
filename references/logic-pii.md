# Airline PII Data Classification

| Column | Ý nghĩa | Domain PII | PII Class | Sensitive | Masking | Encrypt |
|---|---|---|---|---|---|---|
| `PassengerID` | Mã định danh hành khách | Passenger | Direct PII | No | Yes | Yes |
| `FullName` | Họ và tên hành khách | Passenger | Direct PII | No | Yes | Yes |
| `FirstName` | Tên hành khách | Passenger | Direct PII | No | Yes | Yes |
| `LastName` | Họ hành khách | Passenger | Direct PII | No | Yes | Yes |
| `DateOfBirth` | Ngày sinh hành khách | Passenger | Direct PII | No | Yes | Yes |
| `Gender` | Giới tính hành khách | Passenger | Direct PII | No | Yes | Yes |
| `Nationality` | Quốc tịch hành khách | Passenger | Direct PII | No | Yes | Yes |
| `PlaceOfBirth` | Nơi sinh hành khách | Passenger | Direct PII | No | Yes | Yes |
| `PassportNumber` | Số hộ chiếu của hành khách | Travel Document | Direct PII | No | Yes | Yes |
| `NationalIDNumber` | Số giấy tờ tùy thân/CCCD của hành khách | Travel Document | Direct PII | No | Yes | Yes |
| `VisaNumber` | Số thị thực của hành khách | Travel Document | Direct PII | No | Yes | Yes |
| `MRZ` | Dữ liệu vùng đọc máy trên giấy tờ du lịch | Travel Document | Direct PII | No | Yes | Yes |
| `DocumentNumber` | Số giấy tờ du lịch/định danh | Travel Document | Direct PII | No | Yes | Yes |
| `DocumentExpiryDate` | Ngày hết hạn giấy tờ du lịch | Travel Document | Direct PII | No | Yes | Yes |
| `Email` | Địa chỉ email của hành khách | Contact | Direct PII | No | Yes | Yes |
| `PhoneNumber` | Số điện thoại của hành khách | Contact | Direct PII | No | Yes | Yes |
| `Address` | Địa chỉ liên hệ của hành khách | Contact | Direct PII | No | Yes | Yes |
| `City` | Thành phố nơi hành khách cư trú/liên hệ | Contact | Indirect PII | No | Yes | Maybe |
| `PostalCode` | Mã bưu chính địa chỉ hành khách | Contact | Indirect PII | No | Yes | Maybe |
| `PNR` | Mã hồ sơ đặt chỗ của hành khách | Booking | Indirect PII | No | Yes | Yes |
| `BookingReference` | Mã tham chiếu đặt chỗ | Booking | Indirect PII | No | Yes | Yes |
| `ReservationID` | Mã định danh giao dịch đặt chỗ | Booking | Indirect PII | No | Yes | Yes |
| `BookingDate` | Ngày tạo đặt chỗ | Booking | Contextual PII | No | Maybe | Maybe |
| `TicketNumber` | Số vé điện tử của hành khách | Ticket | Indirect PII | No | Yes | Yes |
| `Fare` | Giá vé/hạng mục giá áp dụng cho hành khách | Ticket | Contextual PII | No | Maybe | Maybe |
| `FareBasis` | Mã điều kiện/loại giá vé | Ticket | Contextual PII | No | Maybe | Maybe |
| `TravelDate` | Ngày hành khách thực hiện chuyến bay | Itinerary | Indirect PII | No | Maybe | Maybe |
| `PassengerItinerary` | Hành trình bay của hành khách | Itinerary | Indirect PII | No | Yes | Yes |
| `SeatNumber` | Số ghế hành khách được phân bổ | DCS | Indirect PII | No | Yes | Maybe |
| `BoardingPassNumber` | Số định danh thẻ lên máy bay | DCS | Indirect PII | No | Yes | Yes |
| `BoardingPassBarcode` | Mã vạch/QR trên thẻ lên máy bay | DCS | Direct/Indirect PII | No | Yes | Yes |
| `CheckInStatus` | Trạng thái làm thủ tục của hành khách | DCS | Contextual PII | No | Maybe | Maybe |
| `BoardingStatus` | Trạng thái lên máy bay của hành khách | DCS | Contextual PII | No | Maybe | Maybe |
| `BaggageTagNumber` | Số thẻ hành lý gắn với hành khách | Baggage | Indirect PII | No | Yes | Yes |
| `BaggageInformation` | Thông tin hành lý của hành khách | Baggage | Indirect PII | No | Yes | Yes |
| `BaggageWeight` | Trọng lượng hành lý của hành khách | Baggage | Contextual PII | No | Maybe | Maybe |
| `FrequentFlyerNumber` | Số thẻ hội viên chương trình khách hàng thường xuyên | Loyalty | Direct PII | No | Yes | Yes |
| `LoyaltyID` | Mã định danh tài khoản khách hàng thân thiết | Loyalty | Direct PII | No | Yes | Yes |
| `MembershipNumber` | Số hiệu thẻ hội viên | Loyalty | Direct PII | No | Yes | Yes |
| `PointsBalance` | Số điểm/miles hiện có của hội viên | Loyalty | Contextual PII | No | Maybe | Maybe |
| `TravelHistory` | Lịch sử các chuyến bay của hành khách | Loyalty | Indirect PII | No | Yes | Yes |
| `CardNumber` | Số thẻ thanh toán được sử dụng | Payment | Direct PII | No | Yes | Yes |
| `CardHolderName` | Tên chủ thẻ thanh toán | Payment | Direct PII | No | Yes | Yes |
| `BillingAddress` | Địa chỉ thanh toán của khách hàng | Payment | Direct PII | No | Yes | Yes |
| `PaymentTransactionID` | Mã giao dịch thanh toán của hành khách | Payment | Indirect PII | No | Yes | Yes |
| `MedicalInformation` | Thông tin y tế/sức khỏe của hành khách | SSR | Sensitive PII | Yes | Yes | Yes |
| `MedicalSSR` | Yêu cầu dịch vụ đặc biệt liên quan đến tình trạng y tế | SSR | Sensitive PII | Yes | Yes | Yes |
| `DisabilityInformation` | Thông tin liên quan đến tình trạng khuyết tật của hành khách | SSR | Sensitive PII | Yes | Yes | Yes |
| `WheelchairSSR` | Yêu cầu hỗ trợ xe lăn của hành khách | SSR | Sensitive PII | Yes | Yes | Yes |
| `UnaccompaniedMinor` | Thông tin hành khách là trẻ vị thành niên đi một mình | SSR | Sensitive PII | Yes | Yes | Yes |
| `InfantInformation` | Thông tin trẻ sơ sinh đi cùng hành khách | SSR | Sensitive PII | Yes | Yes | Yes |
| `MealPreference` | Lựa chọn suất ăn của hành khách | SSR | Contextual/Sensitive PII | Potentially | Yes | Yes |
| `FaceImage` | Hình ảnh khuôn mặt hành khách | Biometric | Sensitive PII | Yes | Yes | Yes |
| `FaceTemplate` | Mẫu dữ liệu sinh trắc học khuôn mặt | Biometric | Sensitive PII | Yes | Yes | Yes |
| `Fingerprint` | Dữ liệu dấu vân tay của hành khách | Biometric | Sensitive PII | Yes | Yes | Yes |
| `IrisData` | Dữ liệu sinh trắc học mống mắt | Biometric | Sensitive PII | Yes | Yes | Yes |