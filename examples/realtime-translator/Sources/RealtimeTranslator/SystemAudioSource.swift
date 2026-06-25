import Foundation
import AVFoundation
import ScreenCaptureKit
import CoreMedia
import os
import TranslatorKit

/// Real system-audio capture via ScreenCaptureKit (system audio only — never the
/// microphone). Requires Screen Recording permission at runtime; the contract's
/// CoreAudio process-tap (a reference app) is the documented fallback.
final class SystemAudioSource: NSObject, AudioSource, SCStreamOutput {
    private var stream: SCStream?
    private var continuation: AsyncStream<AudioFrame>.Continuation?
    private let sampleQueue = DispatchQueue(label: "com.kiln.realtimetranslator.audio")
    private let log = Logger(subsystem: "com.kiln.realtimetranslator", category: "capture")
    private let captureOSLog = OSLog(subsystem: "com.kiln.realtimetranslator", category: "capture")
    private var loggedFirstFrame = false
    private let outputFormat = AVAudioFormat(commonFormat: .pcmFormatFloat32,
                                             sampleRate: 24_000,
                                             channels: 1,
                                             interleaved: false)!
    private var converter: AVAudioConverter?
    private var converterInputSignature: AudioFormatSignature?

    func frames() -> AsyncStream<AudioFrame> {
        AsyncStream { continuation in
            self.continuation = continuation
            Task { await self.startCapture() }
        }
    }

    private func startCapture() async {
        do {
            let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: false)
            guard let display = content.displays.first else {
                log.error("capture: no display available")
                continuation?.finish(); return
            }
            let filter = SCContentFilter(display: display, excludingApplications: [], exceptingWindows: [])
            let config = SCStreamConfiguration()
            config.capturesAudio = true
            config.sampleRate = 24_000
            config.channelCount = 1
            let stream = SCStream(filter: filter, configuration: config, delegate: nil)
            try stream.addStreamOutput(self, type: .audio, sampleHandlerQueue: sampleQueue)
            try await stream.startCapture()
            self.stream = stream
            log.info("capture started: system audio @ 24kHz")
        } catch {
            log.error("capture FAILED: \(error.localizedDescription, privacy: .public)")
            continuation?.finish()
        }
    }

    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .audio else { return }
        logFirstBufferFormat(sampleBuffer)
        guard let samples = resampledSamples(from: sampleBuffer) else { return }
        continuation?.yield(AudioFrame(samples: samples, sampleRate: 24_000))
    }

    private func logFirstBufferFormat(_ sampleBuffer: CMSampleBuffer) {
        guard !loggedFirstFrame else { return }
        loggedFirstFrame = true

        let framesPerBuffer = CMSampleBufferGetNumSamples(sampleBuffer)
        guard let formatDescription = CMSampleBufferGetFormatDescription(sampleBuffer),
              let streamDescription = CMAudioFormatDescriptionGetStreamBasicDescription(formatDescription) else {
            os_log("first audio format: sampleRate=%{public}.2f channelCount=%{public}u framesPerBuffer=%{public}d",
                   log: captureOSLog,
                   type: .info,
                   0.0,
                   UInt32(0),
                   framesPerBuffer)
            return
        }

        let audioDescription = streamDescription.pointee
        os_log("first audio format: sampleRate=%{public}.2f channelCount=%{public}u framesPerBuffer=%{public}d",
               log: captureOSLog,
               type: .info,
               audioDescription.mSampleRate,
               audioDescription.mChannelsPerFrame,
               framesPerBuffer)
    }

    private func resampledSamples(from sampleBuffer: CMSampleBuffer) -> [Float]? {
        guard let formatDescription = CMSampleBufferGetFormatDescription(sampleBuffer),
              let streamDescription = CMAudioFormatDescriptionGetStreamBasicDescription(formatDescription) else {
            return nil
        }

        let audioDescription = streamDescription.pointee
        let inputSignature = AudioFormatSignature(audioDescription)
        guard let inputFormat = AVAudioFormat(streamDescription: streamDescription),
              let converter = converter(for: inputFormat, signature: inputSignature) else {
            return nil
        }

        let inputFrameCount = CMSampleBufferGetNumSamples(sampleBuffer)
        guard inputFrameCount > 0,
              let inputBuffer = AVAudioPCMBuffer(pcmFormat: inputFormat,
                                                 frameCapacity: AVAudioFrameCount(inputFrameCount)) else {
            return nil
        }
        inputBuffer.frameLength = AVAudioFrameCount(inputFrameCount)

        let copyStatus = CMSampleBufferCopyPCMDataIntoAudioBufferList(sampleBuffer,
                                                                      at: 0,
                                                                      frameCount: Int32(inputFrameCount),
                                                                      into: inputBuffer.mutableAudioBufferList)
        guard copyStatus == noErr else { return nil }

        let outputFrameCapacity = AVAudioFrameCount(ceil(Double(inputFrameCount) * outputFormat.sampleRate / inputFormat.sampleRate)) + 16
        guard let outputBuffer = AVAudioPCMBuffer(pcmFormat: outputFormat,
                                                  frameCapacity: max(1, outputFrameCapacity)) else {
            return nil
        }

        var didProvideInput = false
        var conversionError: NSError?
        let status = converter.convert(to: outputBuffer, error: &conversionError) { _, outStatus in
            if didProvideInput {
                outStatus.pointee = .noDataNow
                return nil
            }
            didProvideInput = true
            outStatus.pointee = .haveData
            return inputBuffer
        }

        guard status != .error,
              conversionError == nil,
              outputBuffer.frameLength > 0,
              let channelData = outputBuffer.floatChannelData else {
            return nil
        }

        return Array(UnsafeBufferPointer(start: channelData[0],
                                         count: Int(outputBuffer.frameLength)))
    }

    private func converter(for inputFormat: AVAudioFormat, signature: AudioFormatSignature) -> AVAudioConverter? {
        if let converter, converterInputSignature == signature {
            return converter
        }

        let converter = AVAudioConverter(from: inputFormat, to: outputFormat)
        converter?.sampleRateConverterQuality = AVAudioQuality.max.rawValue
        self.converter = converter
        converterInputSignature = signature
        return converter
    }

    func stop() {
        stream?.stopCapture { _ in }
        stream = nil
        converter = nil
        converterInputSignature = nil
        continuation?.finish()
    }

    private struct AudioFormatSignature: Equatable {
        let sampleRate: Double
        let formatID: AudioFormatID
        let formatFlags: AudioFormatFlags
        let bytesPerPacket: UInt32
        let framesPerPacket: UInt32
        let bytesPerFrame: UInt32
        let channelsPerFrame: UInt32
        let bitsPerChannel: UInt32

        init(_ description: AudioStreamBasicDescription) {
            sampleRate = description.mSampleRate
            formatID = description.mFormatID
            formatFlags = description.mFormatFlags
            bytesPerPacket = description.mBytesPerPacket
            framesPerPacket = description.mFramesPerPacket
            bytesPerFrame = description.mBytesPerFrame
            channelsPerFrame = description.mChannelsPerFrame
            bitsPerChannel = description.mBitsPerChannel
        }
    }
}
