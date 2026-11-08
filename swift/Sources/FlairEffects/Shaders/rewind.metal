// flair-metal-hash: cea2df69
#pragma clang diagnostic ignored "-Wmissing-prototypes"
#pragma clang diagnostic ignored "-Wmissing-braces"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

template<typename T, size_t Num>
struct spvUnsafeArray
{
    T elements[Num ? Num : 1];
    
    thread T& operator [] (size_t pos) thread
    {
        return elements[pos];
    }
    constexpr const thread T& operator [] (size_t pos) const thread
    {
        return elements[pos];
    }
    
    device T& operator [] (size_t pos) device
    {
        return elements[pos];
    }
    constexpr const device T& operator [] (size_t pos) const device
    {
        return elements[pos];
    }
    
    constexpr const constant T& operator [] (size_t pos) const constant
    {
        return elements[pos];
    }
    
    threadgroup T& operator [] (size_t pos) threadgroup
    {
        return elements[pos];
    }
    constexpr const threadgroup T& operator [] (size_t pos) const threadgroup
    {
        return elements[pos];
    }
};

// Implementation of the GLSL mod() function, which is slightly different than Metal fmod()
template<typename Tx, typename Ty>
inline Tx mod(Tx x, Ty y)
{
    return x - y * floor(x / y);
}

struct FlairUniforms
{
    packed_float3 iResolution;
    float iTime;
    float iTimeDelta;
    int iFrame;
    float iBeat;
    float flair_flipY;
    float4 iMouse;
    float4 iPointer;
    float4 iClicks[8];
    float4 iTrail[32];
    float4 iAudio;
    float4 iSpectrum[16];
    float4 iScroll;
    float uNoise;
    float uJitter;
    float uBleed;
    uint uOsd;
    float3 uOsdColor;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

constant spvUnsafeArray<int, 10> _468 = spvUnsafeArray<int, 10>({ 63, 6, 91, 79, 102, 109, 125, 7, 127, 111 });

struct flair_rewind_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float2 coverOf(texture2d<float> tex, sampler texSmplr, constant FlairUniforms& _124)
{
    float2 size = float2(int2(tex.get_width(), tex.get_height()));
    float frameAspect = _124.iResolution[0u] / _124.iResolution[1u];
    float _301;
    if (size.x > 1.0)
    {
        _301 = size.x / size.y;
    }
    else
    {
        _301 = frameAspect;
    }
    float imageAspect = _301;
    float2 _315;
    if (frameAspect > imageAspect)
    {
        _315 = float2(1.0, imageAspect / frameAspect);
    }
    else
    {
        _315 = float2(frameAspect / imageAspect, 1.0);
    }
    return _315;
}

static inline __attribute__((always_inline))
float2 swayUv(texture2d<float> tex, sampler texSmplr, thread const float2& uv, thread const float& t, thread const float& amount, constant FlairUniforms& _124)
{
    float2 cover = coverOf(tex, texSmplr, _124);
    float aspect = _124.iResolution[0u] / _124.iResolution[1u];
    float w = 0.785398006439208984375;
    float zoom = 1.2999999523162841796875 + ((0.180000007152557373046875 * amount) * sin((w * t) + 0.699999988079071044921875));
    float angle = (0.070000000298023223876953125 * amount) * sin(((2.0 * w) * t) + 0.4000000059604644775390625);
    float2 pan = float2((0.100000001490116119384765625 * sin(w * t)) + (0.039999999105930328369140625 * sin(((3.0 * w) * t) + 1.2999999523162841796875)), 0.070000000298023223876953125 * sin(((2.0 * w) * t) + 2.099999904632568359375)) * amount;
    float2 p = (uv - float2(0.5)) * float2(aspect, 1.0);
    float c = cos(angle);
    float s = sin(angle);
    p = (float2x2(float2(c, s), float2(-s, c)) * p) / float2(aspect, 1.0);
    return float2(0.5) + (((p / float2(zoom)) + pan) * cover);
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _124)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_124.uBackdrop) * _124.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_124.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

static inline __attribute__((always_inline))
float3 testCard(thread const float2& uv)
{
    float3 sky = mix(float3(0.980000019073486328125, 0.62000000476837158203125, 0.4199999868869781494140625), float3(0.23999999463558197021484375, 0.319999992847442626953125, 0.7200000286102294921875), float3(uv.y));
    float sun = smoothstep(0.1599999964237213134765625, 0.1500000059604644775390625, length((uv - float2(0.64999997615814208984375, 0.579999983310699462890625)) * float2(1.60000002384185791015625, 1.0)));
    float hills = step(uv.y, (0.319999992847442626953125 + (0.0599999986588954925537109375 * sin(uv.x * 9.0))) + (0.039999999105930328369140625 * sin((uv.x * 23.0) + 1.0)));
    float3 col = mix(sky, float3(1.0, 0.920000016689300537109375, 0.699999988079071044921875), float3(sun));
    col = mix(col, float3(0.119999997317790985107421875, 0.2800000011920928955078125, 0.23999999463558197021484375) + float3(0.07999999821186065673828125 * sin(uv.x * 40.0)), float3(hills));
    float2 grid = abs(fract(uv * 8.0) - float2(0.5));
    col += float3(0.039999999105930328369140625 * step(0.4799999892711639404296875, fast::max(grid.x, grid.y)));
    return col;
}

static inline __attribute__((always_inline))
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _124)
{
    float4 _266;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _266 = overBackdrop(param, _124);
    }
    else
    {
        float2 param_1 = fract(uv);
        _266 = float4(testCard(param_1), 1.0);
    }
    return _266;
}

static inline __attribute__((always_inline))
float playIcon(thread const float2& q)
{
    float inside = fast::min(q.x, (0.5 * (1.0 - q.x)) - abs(q.y - 0.5));
    return smoothstep(0.0, 0.039999999105930328369140625, inside);
}

static inline __attribute__((always_inline))
float segDist(thread const float2& p, thread const float2& a, thread const float2& b)
{
    float2 pa = p - a;
    float2 ba = b - a;
    return length(pa - (ba * fast::clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)));
}

static inline __attribute__((always_inline))
float digit7(thread const float2& p, thread const int& d)
{
    int m = _468[clamp(d, 0, 9)];
    float dist = 100000.0;
    if ((m & 1) != 0)
    {
        float2 param = p;
        float2 param_1 = float2(0.0, 2.0);
        float2 param_2 = float2(1.0, 2.0);
        dist = fast::min(dist, segDist(param, param_1, param_2));
    }
    if ((m & 2) != 0)
    {
        float2 param_3 = p;
        float2 param_4 = float2(1.0, 2.0);
        float2 param_5 = float2(1.0);
        dist = fast::min(dist, segDist(param_3, param_4, param_5));
    }
    if ((m & 4) != 0)
    {
        float2 param_6 = p;
        float2 param_7 = float2(1.0);
        float2 param_8 = float2(1.0, 0.0);
        dist = fast::min(dist, segDist(param_6, param_7, param_8));
    }
    if ((m & 8) != 0)
    {
        float2 param_9 = p;
        float2 param_10 = float2(0.0);
        float2 param_11 = float2(1.0, 0.0);
        dist = fast::min(dist, segDist(param_9, param_10, param_11));
    }
    if ((m & 16) != 0)
    {
        float2 param_12 = p;
        float2 param_13 = float2(0.0);
        float2 param_14 = float2(0.0, 1.0);
        dist = fast::min(dist, segDist(param_12, param_13, param_14));
    }
    if ((m & 32) != 0)
    {
        float2 param_15 = p;
        float2 param_16 = float2(0.0, 1.0);
        float2 param_17 = float2(0.0, 2.0);
        dist = fast::min(dist, segDist(param_15, param_16, param_17));
    }
    if ((m & 64) != 0)
    {
        float2 param_18 = p;
        float2 param_19 = float2(0.0, 1.0);
        float2 param_20 = float2(1.0);
        dist = fast::min(dist, segDist(param_18, param_19, param_20));
    }
    return dist;
}

static inline __attribute__((always_inline))
float timecode(thread const float2& q, thread const float& secs)
{
    bool _580 = q.y < (-0.300000011920928955078125);
    bool _588;
    if (!_580)
    {
        _588 = q.y > 2.2999999523162841796875;
    }
    else
    {
        _588 = _580;
    }
    bool _595;
    if (!_588)
    {
        _595 = q.x < (-0.300000011920928955078125);
    }
    else
    {
        _595 = _588;
    }
    if (_595)
    {
        return 0.0;
    }
    int slot = int(floor(q.x / 1.60000002384185791015625));
    float2 c = float2(q.x - (float(slot) * 1.60000002384185791015625), q.y);
    int s = int(floor(mod(secs, 60.0)));
    int f = int(floor(fract(secs) * 30.0));
    float dist = 100000.0;
    if (slot == 0)
    {
        float2 param = c;
        int param_1 = int(floor(secs / 60.0));
        dist = digit7(param, param_1);
    }
    else
    {
        if ((slot == 1) || (slot == 4))
        {
            dist = fast::min(length(c - float2(0.5, 0.60000002384185791015625)), length(c - float2(0.5, 1.39999997615814208984375)));
        }
        else
        {
            if (slot == 2)
            {
                float2 param_2 = c;
                int param_3 = s / 10;
                dist = digit7(param_2, param_3);
            }
            else
            {
                if (slot == 3)
                {
                    float2 param_4 = c;
                    int param_5 = s - ((s / 10) * 10);
                    dist = digit7(param_4, param_5);
                }
                else
                {
                    if (slot == 5)
                    {
                        float2 param_6 = c;
                        int param_7 = f / 10;
                        dist = digit7(param_6, param_7);
                    }
                    else
                    {
                        if (slot == 6)
                        {
                            float2 param_8 = c;
                            int param_9 = f - ((f / 10) * 10);
                            dist = digit7(param_8, param_9);
                        }
                    }
                }
            }
        }
    }
    return smoothstep(0.20000000298023223876953125, 0.119999997317790985107421875, dist);
}

static inline __attribute__((always_inline))
float osd(thread const float2& fragCoord, thread const float& phase, thread const float& tau, constant FlairUniforms& _124)
{
    float unit = _124.iResolution[1u] * 0.04500000178813934326171875;
    float2 q = (fragCoord - float2(_124.iResolution[0u] - (unit * 3.400000095367431640625), _124.iResolution[1u] - (unit * 2.400000095367431640625))) / float2(unit);
    float ink = 0.0;
    if (phase >= 4.0)
    {
        float2 param = float2(1.0 - q.x, q.y);
        float2 param_1 = float2(2.0 - q.x, q.y);
        ink = fast::max(playIcon(param), playIcon(param_1));
    }
    else
    {
        if (phase < 1.5)
        {
            float2 param_2 = q;
            ink = playIcon(param_2);
        }
    }
    float2 t = (fragCoord - float2(_124.iResolution[0u] - (unit * 6.5), unit * 1.0)) / float2(unit * 0.5);
    float2 param_3 = t;
    float param_4 = tau;
    return fast::max(ink, timecode(param_3, param_4));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _124, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_124.iResolution[0], _124.iResolution[1]);
    float phase = mod(_124.iTime, 6.0);
    float _830;
    if (phase < 4.0)
    {
        _830 = phase;
    }
    else
    {
        _830 = 4.0 - ((phase - 4.0) * 2.0);
    }
    float tau = _830;
    float rw = smoothstep(3.900000095367431640625, 4.099999904632568359375, phase) * (1.0 - smoothstep(5.849999904632568359375, 6.0, phase));
    float shake = 0.1500000059604644775390625 + rw;
    float frame = mod(floor(_124.iTime * 30.0), 180.0);
    float line = floor(uv.y * 240.0);
    float2 param = float2(line, frame);
    float jitter = (((hash12(param) - 0.5) * 0.01200000010430812835693359375) * _124.uJitter) * shake;
    float2 param_1 = float2(frame, 2.0);
    jitter += ((((1.0 - smoothstep(0.0, 0.0500000007450580596923828125, uv.y)) * 0.02999999932944774627685546875) * _124.uJitter) * (hash12(param_1) - 0.20000000298023223876953125));
    float roll = fract((uv.y * 1.7000000476837158203125) + (_124.iTime * 1.5));
    float bar = ((smoothstep(0.0, 0.0199999995529651641845703125, roll) * smoothstep(0.100000001490116119384765625, 0.039999999105930328369140625, roll)) * _124.uNoise) * rw;
    float2 st = uv + float2(jitter + (bar * 0.0599999986588954925537109375), 0.0);
    float2 param_2 = float2(frame, 5.0);
    st.y += ((rw * 0.00999999977648258209228515625) * (hash12(param_2) - 0.5));
    float bleed = _124.uBleed * (1.0 + (2.0 * rw));
    float t = tau * 1.5;
    float2 param_3 = st + float2(bleed, 0.0);
    float param_4 = t;
    float param_5 = 1.39999997615814208984375;
    float2 param_6 = swayUv(uImage, uImageSmplr, param_3, param_4, param_5, _124);
    float4 r = pictureRGBA(uImage, uImageSmplr, param_6, _124);
    float2 param_7 = st;
    float param_8 = t;
    float param_9 = 1.39999997615814208984375;
    float2 param_10 = swayUv(uImage, uImageSmplr, param_7, param_8, param_9, _124);
    float4 g = pictureRGBA(uImage, uImageSmplr, param_10, _124);
    float2 param_11 = st - float2(bleed, 0.0);
    float param_12 = t;
    float param_13 = 1.39999997615814208984375;
    float2 param_14 = swayUv(uImage, uImageSmplr, param_11, param_12, param_13, _124);
    float4 b = pictureRGBA(uImage, uImageSmplr, param_14, _124);
    float3 col = float3(r.x, g.y, b.z);
    float alpha = fast::max(fast::max(r.w, g.w), b.w);
    float2 param_15 = fragCoord + float2(frame * 17.0);
    float grain = hash12(param_15);
    col = mix(col, float3(grain), float3(bar * 0.75));
    float2 param_16 = float2(floor(fragCoord.x / 6.0), line + (frame * 31.0));
    col += float3(step(0.99849998950958251953125 - ((0.00200000009499490261077880859375 * rw) * _124.uNoise), hash12(param_16)) * _124.uNoise);
    float grey = dot(col, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875));
    col = mix(float3(grey), col, float3(0.85000002384185791015625 - (0.25 * rw))) * float3(1.0299999713897705078125, 1.0, 0.949999988079071044921875);
    col = mix(col, float3(0.07999999821186065673828125), float3((1.0 - smoothstep(0.0, 0.0199999995529651641845703125, uv.y)) * rw));
    col *= (0.939999997615814208984375 + (0.0599999986588954925537109375 * sin(fragCoord.y * 3.141590118408203125)));
    float2 v = uv - float2(0.5);
    col *= (1.0 - (0.3499999940395355224609375 * dot(v, v)));
    if (_124.uOsd != 0u)
    {
        float2 param_17 = fragCoord + float2(-2.0, 2.0);
        float param_18 = phase;
        float param_19 = tau;
        float shadow = osd(param_17, param_18, param_19, _124);
        float2 param_20 = fragCoord;
        float param_21 = phase;
        float param_22 = tau;
        float text = osd(param_20, param_21, param_22, _124);
        col = mix(col, float3(0.0), float3(shadow * 0.5));
        col = mix(col, _124.uOsdColor, float3(text));
        alpha = fast::max(alpha, fast::max(shadow * 0.5, text));
    }
    fragColor = float4(fast::clamp(col, float3(0.0), float3(1.0)), alpha);
}

fragment flair_rewind_frag_out flair_rewind_frag(constant FlairUniforms& _124 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_rewind_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1167;
    if (_124.flair_flipY > 0.5)
    {
        _1167 = _124.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1167 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1167);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _124, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

