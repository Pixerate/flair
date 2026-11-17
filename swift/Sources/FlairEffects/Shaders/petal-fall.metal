// flair-metal-hash: 619b9d88
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

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
    int uShape;
    float3 uColor;
    packed_float3 uTip;
    float uDensity;
    float uSize;
    int uLayers;
    float uSway;
    float uFlip;
    float uBreeze;
    float uSpeed;
    float uGlow;
    uint uDemo;
};

struct flair_petal_fall_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

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
float petalShape(thread const float2& q, thread const int& shape)
{
    if (shape == 0)
    {
        float y = q.y / 0.89999997615814208984375;
        float taper = 0.23999999463558197021484375 + (0.7599999904632568359375 * smoothstep(-1.0, 0.449999988079071044921875, y));
        float notch = (0.36000001430511474609375 * smoothstep(0.2800000011920928955078125, 0.87999999523162841796875, y)) * exp(-powr(q.x / 0.1599999964237213134765625, 2.0));
        float r2 = (((q.x * q.x) / ((0.37999999523162841796875 * taper) * taper)) + (y * y)) + notch;
        return (1.0 - sqrt(fast::max(r2, 0.0))) * 0.64999997615814208984375;
    }
    if (shape == 1)
    {
        float y_1 = q.y / 0.87999999523162841796875;
        float taper_1 = 0.37999999523162841796875 + (0.62000000476837158203125 * smoothstep(-1.0, 0.25, y_1));
        float ruffle = (0.02999999932944774627685546875 * sin((q.x * 9.0) + (y_1 * 3.0))) * smoothstep(0.20000000298023223876953125, 0.89999997615814208984375, y_1);
        float r2_1 = ((q.x * q.x) / ((0.680000007152557373046875 * taper_1) * taper_1)) + powr(y_1 + ruffle, 2.0);
        return (1.0 - sqrt(fast::max(r2_1, 0.0))) * 0.64999997615814208984375;
    }
    float y_2 = q.y / 0.85000002384185791015625;
    float taper_2 = 0.550000011920928955078125 + (0.449999988079071044921875 * smoothstep(-1.0, 0.100000001490116119384765625, y_2));
    float r2_2 = ((q.x * q.x) / ((0.519999980926513671875 * taper_2) * taper_2)) + (y_2 * y_2);
    return (1.0 - sqrt(fast::max(r2_2, 0.0))) * 0.64999997615814208984375;
}

static inline __attribute__((always_inline))
float4 over(thread const float4& acc, thread const float3& c, thread const float& a)
{
    return float4((acc.xyz * (1.0 - a)) + (c * a), (acc.w * (1.0 - a)) + a);
}

static inline __attribute__((always_inline))
float4 drawPetal(thread const float4& acc, thread const float2& rel, thread const float& r, thread const float& spin, thread const float& flip, thread const float& blur, thread const float& depthFade, thread const float& fade, thread const float2& seed, thread const float& px, constant FlairUniforms& _167)
{
    float cf = cos(flip);
    float ac = abs(cf);
    float squash = mix(1.0, fast::max(ac, 0.0500000007450580596923828125), _167.uFlip);
    float param = -spin;
    float2 q = (rot(param) * rel) / float2(r);
    q.x /= (((cf < 0.0) ? (-1.0) : 1.0) * squash);
    float2 param_1 = q;
    int param_2 = _167.uShape;
    float inside = petalShape(param_1, param_2);
    float aa = ((px / fast::max(r, 9.9999997473787516355514526367188e-06)) * 1.60000002384185791015625) + blur;
    float cover = smoothstep(-aa, aa, inside);
    if (cover <= 0.001000000047497451305389404296875)
    {
        return acc;
    }
    float grad = smoothstep(-0.75, 0.75, q.y);
    float3 col = mix(_167.uColor, float3(_167.uTip), float3(grad * 0.85000002384185791015625));
    col *= (0.87999999523162841796875 + (0.14000000059604644775390625 * smoothstep(0.0, 0.37999999523162841796875, inside)));
    if (cf < 0.0)
    {
        col = mix(col, mix(col, float3(1.0), float3(0.20000000298023223876953125)), float3(0.3499999940395355224609375));
    }
    col += (((float3(_167.uTip) * (1.0 - ac)) * 0.1599999964237213134765625) * _167.uFlip);
    col += ((mix(_167.uColor, float3(_167.uTip), float3(0.5)) * _167.uGlow) * 0.449999988079071044921875);
    col = mix(col, (col * 0.7799999713897705078125) + float3(0.0599999986588954925537109375), float3(depthFade));
    float alpha = (cover * fade) * fast::clamp(0.86000001430511474609375 + (0.119999997317790985107421875 * (1.0 - ac)), 0.0, 1.0);
    float4 param_3 = acc;
    float3 param_4 = fast::min(col, float3(1.2000000476837158203125));
    float param_5 = alpha;
    return over(param_3, param_4, param_5);
}

static inline __attribute__((always_inline))
float4 clickAt(thread const int& i, thread const bool& demo, thread const float& period, constant FlairUniforms& _167)
{
    bool _155 = !demo;
    bool _175;
    if (!_155)
    {
        _175 = _167.iClicks[0].w > 0.5;
    }
    else
    {
        _175 = _155;
    }
    if (_175)
    {
        return _167.iClicks[i];
    }
    float k = floor(_167.iTime / period) - float(i);
    float2 param = float2((k * 1.37000000476837158203125) + 0.5, 3.7000000476837158203125);
    float2 h = hash22(param);
    return float4((float2(0.20000000298023223876953125) + (h * 0.60000002384185791015625)) * float2(_167.iResolution[0], _167.iResolution[1]), k * period, 1.0);
}

static inline __attribute__((always_inline))
float4 unpremultiply(thread const float4& acc)
{
    return float4(acc.xyz / float3(fast::max(acc.w, 9.9999997473787516355514526367188e-05)), acc.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _167)
{
    float px = 1.0 / _167.iResolution[1u];
    float2 p = (fragCoord - (float2(_167.iResolution[0], _167.iResolution[1]) * 0.5)) * px;
    float4 acc = float4(0.0);
    int layers = clamp(_167.uLayers, 1, 5);
    if (_167.uDensity > 0.001000000047497451305389404296875)
    {
        float _577;
        for (int l = 4; l >= 0; l--)
        {
            if (l >= layers)
            {
                continue;
            }
            float fl = float(l);
            if (layers > 1)
            {
                _577 = fl / float(layers - 1);
            }
            else
            {
                _577 = 0.0;
            }
            float depthNorm = _577;
            float sc = 1.0 - (0.1599999964237213134765625 * fl);
            float cs = _167.uSize * 4.19999980926513671875;
            float fallY = ((0.1599999964237213134765625 + (0.0599999986588954925537109375 * (1.0 - depthNorm))) * _167.uSpeed) * _167.iTime;
            float driftX = ((_167.uBreeze * 0.25) * (0.64999997615814208984375 + (0.3499999940395355224609375 * sc))) * _167.iTime;
            float2 pl = ((p / float2(sc)) - float2(driftX, -fallY)) + float2(fl * 5.69999980926513671875);
            float2 cell = floor(pl / float2(cs));
            float blur = ((l == 0) && (layers > 1)) ? 0.100000001490116119384765625 : 0.0;
            float depthFade = 0.3499999940395355224609375 * depthNorm;
            for (int j = -1; j <= 1; j++)
            {
                for (int i = -1; i <= 1; i++)
                {
                    float2 c = cell + float2(float(i), float(j));
                    float2 param = c + float2(0.189999997615814208984375 * fl);
                    float2 param_1 = (c + float2(4.30000019073486328125)) + float2(fl);
                    float4 h = float4(hash22(param), hash22(param_1));
                    if (h.x > _167.uDensity)
                    {
                        continue;
                    }
                    float t = (_167.iTime * (0.699999988079071044921875 + (0.60000002384185791015625 * h.y))) + (h.z * 20.0);
                    float2 swayOff = float2((0.2199999988079071044921875 * _167.uSway) * sin((t * 1.14999997615814208984375) + (h.w * 6.283185482025146484375)), (0.119999997317790985107421875 * _167.uSway) * cos((t * 0.85000002384185791015625) + (h.z * 6.283185482025146484375))) * cs;
                    float2 centre = (((c + float2(0.5)) + ((h.zw - float2(0.5)) * 0.37999999523162841796875)) * cs) + swayOff;
                    float r = _167.uSize * (0.7200000286102294921875 + (0.560000002384185791015625 * h.w));
                    float2 rel = pl - centre;
                    if (length(rel) > (r * 1.4500000476837158203125))
                    {
                        continue;
                    }
                    float spinDir = (h.z < 0.5) ? (-1.0) : 1.0;
                    float spin = (h.y * 6.283185482025146484375) + (spinDir * (((_167.iTime * 0.699999988079071044921875) * _167.uSpeed) + ((0.60000002384185791015625 * _167.uSway) * sin(t * 1.10000002384185791015625))));
                    float flip = ((h.w * 6.283185482025146484375) + ((_167.iTime * (1.39999997615814208984375 + (1.2000000476837158203125 * h.y))) * (0.4000000059604644775390625 + (0.60000002384185791015625 * _167.uSway)))) + ((_167.uBreeze * 0.5) * _167.iTime);
                    float4 param_2 = acc;
                    float2 param_3 = rel;
                    float param_4 = r;
                    float param_5 = spin;
                    float param_6 = flip;
                    float param_7 = blur;
                    float param_8 = depthFade;
                    float param_9 = 1.0;
                    float2 param_10 = h.xy;
                    float param_11 = px / sc;
                    acc = drawPetal(param_2, param_3, param_4, param_5, param_6, param_7, param_8, param_9, param_10, param_11, _167);
                }
            }
        }
    }
    for (int i_1 = 3; i_1 >= 0; i_1--)
    {
        int param_12 = i_1;
        bool param_13 = _167.uDemo != 0u;
        float param_14 = 3.5;
        float4 c_1 = clickAt(param_12, param_13, param_14, _167);
        if (c_1.w < 0.5)
        {
            continue;
        }
        float age = _167.iTime - c_1.z;
        if ((age < 0.0) || (age > 3.400000095367431640625))
        {
            continue;
        }
        float2 origin = (c_1.xy - (float2(_167.iResolution[0], _167.iResolution[1]) * 0.5)) * px;
        float e = (1.0 - exp((-2.0) * age)) / 2.0;
        float drop = (0.2199999988079071044921875 * _167.uSpeed) * age;
        float maxReach = (((0.699999988079071044921875 * e) + drop) + ((abs(_167.uBreeze) * 0.25) * age)) + (_167.uSize * 2.0);
        if (length((p - origin) - float2((_167.uBreeze * 0.1500000059604644775390625) * age, (-drop) * 0.5)) > maxReach)
        {
            continue;
        }
        float fade = 1.0 - smoothstep(2.5, 3.400000095367431640625, age);
        for (int j_1 = 0; j_1 < 14; j_1++)
        {
            float fj = float(j_1);
            float2 param_15 = float2((fj * 3.099999904632568359375) + 1.0, c_1.z);
            float2 param_16 = float2(c_1.z * 2.2999999523162841796875, fj * 5.69999980926513671875);
            float4 h_1 = float4(hash22(param_15), hash22(param_16));
            float ang = h_1.x * 6.283185482025146484375;
            float spd = 0.2800000011920928955078125 + (0.4199999868869781494140625 * h_1.y);
            float2 v0 = float2(cos(ang), (sin(ang) * 0.85000002384185791015625) + 0.25) * spd;
            float2 sway = float2((0.039999999105930328369140625 * _167.uSway) * sin((age * 2.2000000476837158203125) + (h_1.z * 6.283185482025146484375)), 0.0);
            float2 pos = ((origin + (v0 * e)) + float2((_167.uBreeze * 0.20000000298023223876953125) * age, (((-0.2199999988079071044921875) * _167.uSpeed) * (0.699999988079071044921875 + (0.5 * h_1.z))) * age)) + sway;
            float2 rel_1 = p - pos;
            float r_1 = _167.uSize * (0.75 + (0.449999988079071044921875 * h_1.w));
            if (length(rel_1) > (r_1 * 1.4500000476837158203125))
            {
                continue;
            }
            float spin_1 = (h_1.w * 6.283185482025146484375) + ((age * (1.7999999523162841796875 + (1.39999997615814208984375 * h_1.z))) * ((h_1.x < 0.5) ? 1.0 : (-1.0)));
            float flip_1 = (h_1.z * 6.283185482025146484375) + (age * (2.599999904632568359375 + (1.7999999523162841796875 * h_1.y)));
            float4 param_17 = acc;
            float2 param_18 = rel_1;
            float param_19 = r_1;
            float param_20 = spin_1;
            float param_21 = flip_1;
            float param_22 = 0.0;
            float param_23 = 0.0;
            float param_24 = fade;
            float2 param_25 = h_1.xy;
            float param_26 = px;
            acc = drawPetal(param_17, param_18, param_19, param_20, param_21, param_22, param_23, param_24, param_25, param_26, _167);
        }
    }
    float4 param_27 = acc;
    fragColor = unpremultiply(param_27);
}

fragment flair_petal_fall_frag_out flair_petal_fall_frag(constant FlairUniforms& _167 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_petal_fall_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1161;
    if (_167.flair_flipY > 0.5)
    {
        _1161 = _167.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1161 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1161);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _167);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

