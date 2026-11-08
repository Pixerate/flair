// flair-metal-hash: 4e784b43
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

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
    float3 uColor1;
    float3 uColor2;
    float3 uColor3;
    packed_float3 uColor4;
    float uWind;
    float uGust;
    float uDensity;
    float uSize;
    float uTumble;
};

struct flair_leaves_blowing_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float carried(thread const float& t, constant FlairUniforms& _144)
{
    return _144.uWind * (t + (_144.uGust * ((1.0 - cos(0.800000011920928955078125 * t)) + ((0.5 * (0.540302276611328125 - cos((2.099999904632568359375 * t) + 1.0))) / 2.099999904632568359375))));
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float2x2 rot(thread const float& a)
{
    float c = cos(a);
    float s = sin(a);
    return float2x2(float2(c, s), float2(-s, c));
}

static inline __attribute__((always_inline))
float leaf(thread const float2& q, thread const float& shape)
{
    if (shape < 1.0)
    {
        float w = ((0.4600000083446502685546875 * (1.0 - (q.y * q.y))) * (1.0 + (0.25 * q.y))) * (1.0 + (0.0500000007450580596923828125 * sin(q.y * 40.0)));
        return w - abs(q.x);
    }
    if (shape < 2.0)
    {
        float a = precise::atan2(q.x, q.y);
        float lobe = powr(abs(cos(a * 2.5)), 1.60000002384185791015625);
        float r = ((0.5 + (0.5 * lobe)) * (1.0 - (0.100000001490116119384765625 * abs(sin(a * 12.5))))) * (1.0 - (0.300000011920928955078125 * smoothstep(1.89999997615814208984375, 3.1400001049041748046875, abs(a))));
        return (r - length(q)) * 0.60000002384185791015625;
    }
    float w_1 = (0.4000000059604644775390625 * sqrt(fast::max(1.0 - (q.y * q.y), 0.0))) * (0.7200000286102294921875 + (0.2800000011920928955078125 * sin((q.y * 11.0) + 1.0)));
    return w_1 - abs(q.x);
}

static inline __attribute__((always_inline))
float4 over(thread const float4& acc, thread const float3& c, thread const float& a)
{
    return float4((acc.xyz * (1.0 - a)) + (c * a), (acc.w * (1.0 - a)) + a);
}

static inline __attribute__((always_inline))
float4 unpremultiply(thread const float4& acc)
{
    return float4(acc.xyz / float3(fast::max(acc.w, 9.9999997473787516355514526367188e-05)), acc.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _144)
{
    float2 p = (fragCoord - (float2(_144.iResolution[0], _144.iResolution[1]) * 0.5)) / float2(_144.iResolution[1u]);
    float px = 1.0 / _144.iResolution[1u];
    float4 acc = float4(0.0);
    float param = _144.iTime;
    float X = carried(param, _144);
    float gust = _144.uWind * (1.0 + (_144.uGust * ((0.800000011920928955078125 * sin(0.800000011920928955078125 * _144.iTime)) + (0.5 * sin((2.099999904632568359375 * _144.iTime) + 1.0)))));
    float3 _683;
    float3 _692;
    float3 _701;
    float _730;
    for (int l = 2; l >= 0; l--)
    {
        float sc = 1.0 - (0.25 * float(l));
        float cs = _144.uSize * 4.5;
        float2 drift = float2(X * (0.800000011920928955078125 + (0.20000000298023223876953125 * sc)), ((-0.0599999986588954925537109375) * _144.iTime) - ((0.0500000007450580596923828125 * _144.uGust) * sin(0.800000011920928955078125 * _144.iTime)));
        float2 pl = ((p / float2(sc)) - drift) + float2(float(l) * 7.30000019073486328125);
        float2 cell = floor(pl / float2(cs));
        for (int j = -1; j <= 1; j++)
        {
            for (int i = -1; i <= 1; i++)
            {
                float2 c = cell + float2(float(i), float(j));
                float2 param_1 = c + float2(0.12999999523162841796875 * float(l));
                float2 param_2 = (c + float2(3.7000000476837158203125)) + float2(float(l));
                float4 h = float4(hash22(param_1), hash22(param_2));
                if (h.x > _144.uDensity)
                {
                    continue;
                }
                float t = _144.iTime + (h.y * 20.0);
                float2 centre = (((c + float2(0.5)) + ((h.zw - float2(0.5)) * 0.4000000059604644775390625)) * cs) + (float2(0.119999997317790985107421875 * sin(t * 1.2999999523162841796875), (0.1500000059604644775390625 * sin((t * 0.89999997615814208984375) + (h.z * 6.0))) + ((0.100000001490116119384765625 * _144.uGust) * sin(t * 2.2999999523162841796875))) * cs);
                float r = _144.uSize * (0.75 + (0.5 * h.w));
                float2 rel = pl - centre;
                if (length(rel) > (r * 1.39999997615814208984375))
                {
                    continue;
                }
                float spinDir = (h.z < 0.5) ? (-1.0) : 1.0;
                float spin = (h.y * 6.28318023681640625) + ((_144.uTumble * spinDir) * ((X * (2.0 + (2.0 * h.w))) + (0.4000000059604644775390625 * sin(t))));
                float flip = (h.w * 6.28318023681640625) + (_144.uTumble * ((X * (3.0 + (2.0 * h.y))) + (t * 0.60000002384185791015625)));
                float cf = cos(flip);
                float param_3 = -spin;
                float2 q = (rot(param_3) * rel) / float2(r);
                q.x /= (sign(cf) * fast::max(abs(cf), 0.0599999986588954925537109375));
                float shape = floor((h.z * 2.999000072479248046875) + h.x);
                shape = mod(shape, 3.0);
                float2 param_4 = q;
                float param_5 = shape;
                float inside = leaf(param_4, param_5);
                float stemTop = (shape == 1.0) ? (-0.4000000059604644775390625) : (-0.949999988079071044921875);
                float stem = 0.0350000001490116119384765625 - abs(q.x + ((0.0599999986588954925537109375 * (q.y + 1.0)) * (q.y + 1.0)));
                stem = fast::min(stem, fast::min(stemTop - q.y, q.y + 1.35000002384185791015625));
                float edge = fast::max(inside, stem);
                float aa = (px / (r * sc)) * 1.5;
                float cover = smoothstep(-aa, aa, edge);
                if (cover <= 0.0)
                {
                    continue;
                }
                float pick = fract((h.y * 7.0) + (h.x * 3.0)) * 4.0;
                if (pick < 1.0)
                {
                    _683 = _144.uColor1;
                }
                else
                {
                    if (pick < 2.0)
                    {
                        _692 = _144.uColor2;
                    }
                    else
                    {
                        if (pick < 3.0)
                        {
                            _701 = _144.uColor3;
                        }
                        else
                        {
                            _701 = float3(_144.uColor4);
                        }
                        _692 = _701;
                    }
                    _683 = _692;
                }
                float3 colour = _683;
                colour = mix(colour, float3(_144.uColor4), float3((0.5 * smoothstep(0.07999999821186065673828125, 0.0, inside)) * step(-0.5, inside)));
                if (shape == 1.0)
                {
                    _730 = smoothstep(0.0500000007450580596923828125, 0.0, (abs(fract(((precise::atan2(q.x, q.y) / 6.28318023681640625) * 5.0) + 0.5) - 0.5) * length(q)) * 2.0);
                }
                else
                {
                    _730 = fast::max(smoothstep(0.02999999932944774627685546875, 0.0, abs(q.x)), smoothstep(0.039999999105930328369140625, 0.0, abs(fract((q.y - (abs(q.x) * 0.89999997615814208984375)) * 4.0) - 0.5) * 0.25));
                }
                float vein = _730;
                colour *= (1.0 - ((0.300000011920928955078125 * vein) * step(0.0, inside)));
                if (cf < 0.0)
                {
                    colour = mix(colour, float3(dot(colour, float3(0.300000011920928955078125, 0.5, 0.20000000298023223876953125))) * 1.14999997615814208984375, float3(0.3499999940395355224609375));
                }
                colour *= (0.550000011920928955078125 + (0.449999988079071044921875 * abs(cf)));
                colour = mix(colour, (colour * 0.75) + float3(0.0500000007450580596923828125), float3((0.4000000059604644775390625 * float(l)) / 2.0));
                float4 param_6 = acc;
                float3 param_7 = colour;
                float param_8 = cover;
                acc = over(param_6, param_7, param_8);
            }
        }
    }
    float4 param_9 = acc;
    fragColor = unpremultiply(param_9);
}

fragment flair_leaves_blowing_frag_out flair_leaves_blowing_frag(constant FlairUniforms& _144 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_leaves_blowing_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _841;
    if (_144.flair_flipY > 0.5)
    {
        _841 = _144.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _841 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _841);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _144);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

