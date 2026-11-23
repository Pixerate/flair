// flair-metal-hash: 3a3ae178
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
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
    int uCount;
    float uAspect;
    float uSize;
    float uRadius;
    float uHold;
    int uChange;
    char _m19_pad[8];
    packed_float3 uLine;
    uint uHandle;
    uint uDots;
    float uShadow;
    char _m23_pad[8];
    packed_float3 uBackground;
    float uBackgroundAlpha;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_before_after_series_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float ease(thread float& t)
{
    t = fast::clamp(t, 0.0, 1.0);
    return (t * t) * (3.0 - (2.0 * t));
}

static inline __attribute__((always_inline))
float tileBox(thread const float2& p, thread const float2& b, thread const float& r)
{
    float2 q = (abs(p) - b) + float2(r);
    return (length(fast::max(q, float2(0.0))) + fast::min(fast::max(q.x, q.y), 0.0)) - r;
}

static inline __attribute__((always_inline))
float4 over(thread const float4& acc, thread const float3& c, thread const float& a)
{
    return float4((acc.xyz * (1.0 - a)) + (c * a), (acc.w * (1.0 - a)) + a);
}

static inline __attribute__((always_inline))
int2 itemSize(thread const int& i, texture2d<float> uItem0, sampler uItem0Smplr, texture2d<float> uItem1, sampler uItem1Smplr, texture2d<float> uItem2, sampler uItem2Smplr, texture2d<float> uItem3, sampler uItem3Smplr, texture2d<float> uItem4, sampler uItem4Smplr, texture2d<float> uItem5, sampler uItem5Smplr)
{
    if (i == 0)
    {
        return int2(uItem0.get_width(), uItem0.get_height());
    }
    if (i == 1)
    {
        return int2(uItem1.get_width(), uItem1.get_height());
    }
    if (i == 2)
    {
        return int2(uItem2.get_width(), uItem2.get_height());
    }
    if (i == 3)
    {
        return int2(uItem3.get_width(), uItem3.get_height());
    }
    if (i == 4)
    {
        return int2(uItem4.get_width(), uItem4.get_height());
    }
    return int2(uItem5.get_width(), uItem5.get_height());
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _101)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_101.uBackdrop) * _101.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_101.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _101)
{
    float4 _244;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _244 = overBackdrop(param, _101);
    }
    else
    {
        float2 param_1 = fract(uv);
        _244 = float4(testCard(param_1), 1.0);
    }
    return _244;
}

static inline __attribute__((always_inline))
float4 itemAt(thread const int& i, thread const float2& uv, constant FlairUniforms& _101, texture2d<float> uItem0, sampler uItem0Smplr, texture2d<float> uItem1, sampler uItem1Smplr, texture2d<float> uItem2, sampler uItem2Smplr, texture2d<float> uItem3, sampler uItem3Smplr, texture2d<float> uItem4, sampler uItem4Smplr, texture2d<float> uItem5, sampler uItem5Smplr)
{
    if (i == 0)
    {
        float2 param = uv;
        return pictureRGBA(uItem0, uItem0Smplr, param, _101);
    }
    if (i == 1)
    {
        float2 param_1 = uv;
        return pictureRGBA(uItem1, uItem1Smplr, param_1, _101);
    }
    if (i == 2)
    {
        float2 param_2 = uv;
        return pictureRGBA(uItem2, uItem2Smplr, param_2, _101);
    }
    if (i == 3)
    {
        float2 param_3 = uv;
        return pictureRGBA(uItem3, uItem3Smplr, param_3, _101);
    }
    if (i == 4)
    {
        float2 param_4 = uv;
        return pictureRGBA(uItem4, uItem4Smplr, param_4, _101);
    }
    float2 param_5 = uv;
    return pictureRGBA(uItem5, uItem5Smplr, param_5, _101);
}

static inline __attribute__((always_inline))
float4 itemCover(thread const int& i, thread float2& uv, thread const float& aspect, constant FlairUniforms& _101, texture2d<float> uItem0, sampler uItem0Smplr, texture2d<float> uItem1, sampler uItem1Smplr, texture2d<float> uItem2, sampler uItem2Smplr, texture2d<float> uItem3, sampler uItem3Smplr, texture2d<float> uItem4, sampler uItem4Smplr, texture2d<float> uItem5, sampler uItem5Smplr)
{
    int param = i;
    int2 ts = itemSize(param, uItem0, uItem0Smplr, uItem1, uItem1Smplr, uItem2, uItem2Smplr, uItem3, uItem3Smplr, uItem4, uItem4Smplr, uItem5, uItem5Smplr);
    bool _481 = ts.x > 1;
    bool _487;
    if (_481)
    {
        _487 = ts.y > 1;
    }
    else
    {
        _487 = _481;
    }
    if (_487)
    {
        float ta = float(ts.x) / float(ts.y);
        if (ta > aspect)
        {
            uv.x = (((uv.x - 0.5) * aspect) / ta) + 0.5;
        }
        else
        {
            uv.y = (((uv.y - 0.5) * ta) / aspect) + 0.5;
        }
    }
    int param_1 = i;
    float2 param_2 = uv;
    return itemAt(param_1, param_2, _101, uItem0, uItem0Smplr, uItem1, uItem1Smplr, uItem2, uItem2Smplr, uItem3, uItem3Smplr, uItem4, uItem4Smplr, uItem5, uItem5Smplr);
}

static inline __attribute__((always_inline))
void drawPair(thread float4& acc, thread const float2& p, thread const float& x0, thread const int& pair, thread const int& n, thread const float& split, thread const float& alpha, thread const float2& half_, thread const float& px, constant FlairUniforms& _101, texture2d<float> uItem0, sampler uItem0Smplr, texture2d<float> uItem1, sampler uItem1Smplr, texture2d<float> uItem2, sampler uItem2Smplr, texture2d<float> uItem3, sampler uItem3Smplr, texture2d<float> uItem4, sampler uItem4Smplr, texture2d<float> uItem5, sampler uItem5Smplr)
{
    float2 q = p - float2(x0, 0.0);
    float2 param = q;
    float2 param_1 = half_;
    float param_2 = _101.uRadius;
    float d = tileBox(param, param_1, param_2);
    float2 param_3 = q - float2(0.0, -0.014999999664723873138427734375);
    float2 param_4 = half_;
    float param_5 = _101.uRadius;
    float4 param_6 = acc;
    float3 param_7 = float3(0.0);
    float param_8 = ((alpha * _101.uShadow) * 0.5) * exp(-powr(fast::max(tileBox(param_3, param_4, param_5), 0.0) / 0.02999999932944774627685546875, 2.0));
    acc = over(param_6, param_7, param_8);
    float cover = smoothstep(px, -px, d) * alpha;
    if (cover <= 0.0)
    {
        return;
    }
    float2 uv = (q / (half_ * 2.0)) + float2(0.5);
    int before = min((2 * pair), (n - 1));
    int after = min(((2 * pair) + 1), (n - 1));
    float sx = ((split - 0.5) * 2.0) * half_.x;
    float4 _619;
    if (q.x < sx)
    {
        int param_9 = before;
        float2 param_10 = uv;
        float param_11 = _101.uAspect;
        float4 _630 = itemCover(param_9, param_10, param_11, _101, uItem0, uItem0Smplr, uItem1, uItem1Smplr, uItem2, uItem2Smplr, uItem3, uItem3Smplr, uItem4, uItem4Smplr, uItem5, uItem5Smplr);
        _619 = _630;
    }
    else
    {
        int param_12 = after;
        float2 param_13 = uv;
        float param_14 = _101.uAspect;
        float4 _639 = itemCover(param_12, param_13, param_14, _101, uItem0, uItem0Smplr, uItem1, uItem1Smplr, uItem2, uItem2Smplr, uItem3, uItem3Smplr, uItem4, uItem4Smplr, uItem5, uItem5Smplr);
        _619 = _639;
    }
    float4 pic = _619;
    float4 param_15 = acc;
    float3 param_16 = pic.xyz;
    float param_17 = cover * pic.w;
    acc = over(param_15, param_16, param_17);
    if ((split > 0.001000000047497451305389404296875) && (split < 0.999000012874603271484375))
    {
        float line = smoothstep(px * 1.5, 0.0, abs(q.x - sx) - px);
        float4 param_18 = acc;
        float3 param_19 = float3(_101.uLine);
        float param_20 = line * cover;
        acc = over(param_18, param_19, param_20);
        if (_101.uHandle != 0u)
        {
            float knob = length(q - float2(sx, 0.0));
            float rad = 0.070000000298023223876953125 * half_.y;
            float4 param_21 = acc;
            float3 param_22 = float3(_101.uLine);
            float param_23 = smoothstep(px, -px, knob - rad) * alpha;
            acc = over(param_21, param_22, param_23);
            float4 param_24 = acc;
            float3 param_25 = float3(0.20000000298023223876953125);
            float param_26 = smoothstep(px, -px, abs(knob - (rad * 0.550000011920928955078125)) - (rad * 0.0900000035762786865234375)) * alpha;
            acc = over(param_24, param_25, param_26);
        }
    }
}

static inline __attribute__((always_inline))
float4 finish(thread const float4& acc, constant FlairUniforms& _101)
{
    float4 base = float4(float3(_101.uBackground) * _101.uBackgroundAlpha, _101.uBackgroundAlpha);
    float4 o = float4(acc.xyz + (base.xyz * (1.0 - acc.w)), acc.w + (base.w * (1.0 - acc.w)));
    return float4(o.xyz / float3(fast::max(o.w, 9.9999997473787516355514526367188e-05)), o.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _101, texture2d<float> uItem0, sampler uItem0Smplr, texture2d<float> uItem1, sampler uItem1Smplr, texture2d<float> uItem2, sampler uItem2Smplr, texture2d<float> uItem3, sampler uItem3Smplr, texture2d<float> uItem4, sampler uItem4Smplr, texture2d<float> uItem5, sampler uItem5Smplr)
{
    float2 p = (fragCoord - (float2(_101.iResolution[0], _101.iResolution[1]) * 0.5)) / float2(_101.iResolution[1u]);
    float px = 1.0 / _101.iResolution[1u];
    float aspect = _101.iResolution[0u] / _101.iResolution[1u];
    int n = clamp(_101.uCount, 2, 6);
    int pairs = (n + 1) / 2;
    float h = (_101.uSize * fast::min(1.0, aspect / _101.uAspect)) * ((_101.uDots != 0u) ? 0.89999997615814208984375 : 1.0);
    float2 half_ = float2(h * _101.uAspect, h) * 0.5;
    float2 at = p - float2(0.0, (_101.uDots != 0u) ? 0.039999999105930328369140625 : 0.0);
    float c = _101.iTime / fast::max(_101.uHold, 0.100000001490116119384765625);
    float k = floor(c);
    float f = c - k;
    int pair = int(mod(k, float(pairs)));
    float param = (f - 0.1500000059604644775390625) / 0.5;
    float _833 = ease(param);
    float split = 1.0 - _833;
    float _838;
    if (pairs > 1)
    {
        float param_1 = (f - 0.85000002384185791015625) / 0.1500000059604644775390625;
        float _846 = ease(param_1);
        _838 = _846;
    }
    else
    {
        _838 = 0.0;
    }
    float change = _838;
    float4 acc = float4(0.0);
    if (change <= 0.0)
    {
        float4 param_2 = acc;
        float2 param_3 = at;
        float param_4 = 0.0;
        int param_5 = pair;
        int param_6 = n;
        float param_7 = split;
        float param_8 = 1.0;
        float2 param_9 = half_;
        float param_10 = px;
        drawPair(param_2, param_3, param_4, param_5, param_6, param_7, param_8, param_9, param_10, _101, uItem0, uItem0Smplr, uItem1, uItem1Smplr, uItem2, uItem2Smplr, uItem3, uItem3Smplr, uItem4, uItem4Smplr, uItem5, uItem5Smplr);
        acc = param_2;
    }
    else
    {
        if (_101.uChange == 1)
        {
            float4 param_11 = acc;
            float2 param_12 = at;
            float param_13 = 0.0;
            int param_14 = pair;
            int param_15 = n;
            float param_16 = 0.0;
            float param_17 = 1.0 - change;
            float2 param_18 = half_;
            float param_19 = px;
            drawPair(param_11, param_12, param_13, param_14, param_15, param_16, param_17, param_18, param_19, _101, uItem0, uItem0Smplr, uItem1, uItem1Smplr, uItem2, uItem2Smplr, uItem3, uItem3Smplr, uItem4, uItem4Smplr, uItem5, uItem5Smplr);
            acc = param_11;
            float4 param_20 = acc;
            float2 param_21 = at;
            float param_22 = 0.0;
            int param_23 = int(mod(k + 1.0, float(pairs)));
            int param_24 = n;
            float param_25 = 1.0;
            float param_26 = change;
            float2 param_27 = half_;
            float param_28 = px;
            drawPair(param_20, param_21, param_22, param_23, param_24, param_25, param_26, param_27, param_28, _101, uItem0, uItem0Smplr, uItem1, uItem1Smplr, uItem2, uItem2Smplr, uItem3, uItem3Smplr, uItem4, uItem4Smplr, uItem5, uItem5Smplr);
            acc = param_20;
        }
        else
        {
            float gap = (2.0 * half_.x) + 0.0599999986588954925537109375;
            float4 param_29 = acc;
            float2 param_30 = at;
            float param_31 = (-change) * gap;
            int param_32 = pair;
            int param_33 = n;
            float param_34 = 0.0;
            float param_35 = 1.0;
            float2 param_36 = half_;
            float param_37 = px;
            drawPair(param_29, param_30, param_31, param_32, param_33, param_34, param_35, param_36, param_37, _101, uItem0, uItem0Smplr, uItem1, uItem1Smplr, uItem2, uItem2Smplr, uItem3, uItem3Smplr, uItem4, uItem4Smplr, uItem5, uItem5Smplr);
            acc = param_29;
            float4 param_38 = acc;
            float2 param_39 = at;
            float param_40 = (1.0 - change) * gap;
            int param_41 = int(mod(k + 1.0, float(pairs)));
            int param_42 = n;
            float param_43 = 1.0;
            float param_44 = 1.0;
            float2 param_45 = half_;
            float param_46 = px;
            drawPair(param_38, param_39, param_40, param_41, param_42, param_43, param_44, param_45, param_46, _101, uItem0, uItem0Smplr, uItem1, uItem1Smplr, uItem2, uItem2Smplr, uItem3, uItem3Smplr, uItem4, uItem4Smplr, uItem5, uItem5Smplr);
            acc = param_38;
        }
    }
    if ((_101.uDots != 0u) && (pairs > 1))
    {
        float current = mod(k + float(change > 0.5), float(pairs));
        for (int j = 0; j < 3; j++)
        {
            if (j >= pairs)
            {
                break;
            }
            float2 dc = float2((float(j) - (0.5 * float(pairs - 1))) * 0.0350000001490116119384765625, (-half_.y) - 0.0350000001490116119384765625);
            float on = (float(j) == current) ? 1.0 : 0.3499999940395355224609375;
            float4 param_47 = acc;
            float3 param_48 = (float3(_101.uLine) * 0.5) + (float3(on) * 0.5);
            float param_49 = smoothstep(px, -px, length(at - dc) - 0.008000000379979610443115234375) * mix(0.5, 1.0, on);
            acc = over(param_47, param_48, param_49);
        }
    }
    float4 param_50 = acc;
    fragColor = finish(param_50, _101);
}

fragment flair_before_after_series_frag_out flair_before_after_series_frag(constant FlairUniforms& _101 [[buffer(0)]], texture2d<float> uItem0 [[texture(1)]], texture2d<float> uItem1 [[texture(2)]], texture2d<float> uItem2 [[texture(3)]], texture2d<float> uItem3 [[texture(4)]], texture2d<float> uItem4 [[texture(5)]], texture2d<float> uItem5 [[texture(6)]], sampler uItem0Smplr [[sampler(1)]], sampler uItem1Smplr [[sampler(2)]], sampler uItem2Smplr [[sampler(3)]], sampler uItem3Smplr [[sampler(4)]], sampler uItem4Smplr [[sampler(5)]], sampler uItem5Smplr [[sampler(6)]], float4 gl_FragCoord [[position]])
{
    flair_before_after_series_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1070;
    if (_101.flair_flipY > 0.5)
    {
        _1070 = _101.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1070 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1070);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _101, uItem0, uItem0Smplr, uItem1, uItem1Smplr, uItem2, uItem2Smplr, uItem3, uItem3Smplr, uItem4, uItem4Smplr, uItem5, uItem5Smplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

